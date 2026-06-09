import { Injectable, Logger } from '@nestjs/common';
import type { Prisma, ReferralEarningKind } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.module';
import {
  REFERRAL_FROM_LOSS_BPS,
  REFERRAL_FROM_WIN_BPS,
  calcEarningBps,
} from './referrals.constants';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  private async getRateBps(kind: ReferralEarningKind): Promise<number> {
    const key = kind === 'FROM_LOSS' ? 'referral.from_loss_bps' : 'referral.from_win_bps';
    const fallback = kind === 'FROM_LOSS' ? REFERRAL_FROM_LOSS_BPS : REFERRAL_FROM_WIN_BPS;
    try {
      const v = await this.settings.get<number>(key);
      return typeof v === 'number' && v >= 0 ? v : fallback;
    } catch {
      return fallback;
    }
  }

  /**
   * Начисляет реферальную выплату на баланс пригласившего.
   * Должен вызываться внутри уже открытой транзакции (передавайте `tx`),
   * либо без неё — тогда создаст свою.
   */
  async creditEarning(params: {
    referredId: string;
    kind: ReferralEarningKind;
    sourceAmountMinor: bigint;
    referenceType?: string;
    referenceId?: string;
    tx?: Prisma.TransactionClient;
  }): Promise<void> {
    const { referredId, kind, sourceAmountMinor, referenceType, referenceId } = params;
    if (sourceAmountMinor <= 0n) return;

    // Если реферальная программа выключена флагом — выходим тихо.
    try {
      const enabled = await this.settings.get<boolean>('gameplay.referrals_enabled');
      if (!enabled) return;
    } catch {
      // нет ключа — продолжаем со старой логикой
    }

    const rateBps = await this.getRateBps(kind);
    const earningMinor = calcEarningBps(sourceAmountMinor, rateBps);
    if (earningMinor <= 0n) return;

    const exec = async (client: Prisma.TransactionClient): Promise<void> => {
      const referred = await client.user.findUnique({
        where: { id: referredId },
        select: { referredById: true },
      });
      if (!referred?.referredById) return;
      const referrerId = referred.referredById;

      const earning = await client.referralEarning.create({
        data: {
          referrerId,
          referredId,
          kind,
          sourceAmountMinor,
          earningMinor,
          rateBps,
          referenceType: referenceType ?? null,
          referenceId: referenceId ?? null,
        },
      });

      const updated = await client.user.update({
        where: { id: referrerId },
        data: { balanceMinor: { increment: earningMinor } },
        select: { balanceMinor: true },
      });

      await client.transaction.create({
        data: {
          userId: referrerId,
          type: 'REFERRAL_EARNING',
          status: 'COMPLETED',
          amountMinor: earningMinor,
          balanceAfterMinor: updated.balanceMinor,
          idempotencyKey: `referral:${earning.id}`,
          referenceType: 'referral_earning',
          referenceId: earning.id,
          description: `Referral ${kind === 'FROM_LOSS' ? 'loss' : 'win'} earning from ${referredId}`,
        },
      });

      this.logger.log(
        `Referral earning ${earning.id} → ${referrerId} +${earningMinor} (${kind} from ${referredId})`,
      );
    };

    if (params.tx) {
      await exec(params.tx);
    } else {
      await this.prisma.$transaction((tx) => exec(tx));
    }
  }

  async getSummary(userId: string) {
    const [user, referralsCount, agg, fromLossBps, fromWinBps] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { referralCode: true },
      }),
      this.prisma.user.count({ where: { referredById: userId } }),
      this.prisma.referralEarning.aggregate({
        where: { referrerId: userId },
        _sum: { earningMinor: true },
      }),
      this.getRateBps('FROM_LOSS'),
      this.getRateBps('FROM_WIN'),
    ]);
    return {
      referralCode: user?.referralCode ?? '',
      referralsCount,
      totalEarningsMinor: agg._sum.earningMinor ?? 0n,
      rates: {
        fromLossBps,
        fromWinBps,
      },
    };
  }

  async listEarnings(params: { userId: string; limit: number; cursor?: string }) {
    const { userId, limit, cursor } = params;
    const items = await this.prisma.referralEarning.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: { referred: { select: { username: true } } },
    });
    let nextCursor: string | null = null;
    if (items.length > limit) {
      const next = items.pop();
      nextCursor = next?.id ?? null;
    }
    return { items, nextCursor };
  }

  /**
   * Список приглашённых пользователей (рефералов) с суммой,
   * заработанной пригласившим именно с этого реферала.
   */
  async listReferrals(params: { userId: string; limit: number; cursor?: string }) {
    const { userId, limit, cursor } = params;
    const users = await this.prisma.user.findMany({
      where: { referredById: userId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: { id: true, username: true, createdAt: true, totalWageredMinor: true },
    });
    let nextCursor: string | null = null;
    if (users.length > limit) {
      const next = users.pop();
      nextCursor = next?.id ?? null;
    }

    const grouped = await this.prisma.referralEarning.groupBy({
      by: ['referredId'],
      where: { referrerId: userId, referredId: { in: users.map((u) => u.id) } },
      _sum: { earningMinor: true },
    });
    const earnedMap = new Map<string, bigint>(
      grouped.map((g) => [g.referredId, g._sum.earningMinor ?? 0n]),
    );

    const items = users.map((u) => ({
      id: u.id,
      username: u.username,
      createdAt: u.createdAt,
      totalWageredMinor: u.totalWageredMinor,
      earnedFromMinor: earnedMap.get(u.id) ?? 0n,
    }));
    return { items, nextCursor };
  }
}
