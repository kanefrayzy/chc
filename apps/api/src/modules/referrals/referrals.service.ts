import { Injectable, Logger } from '@nestjs/common';
import type { Prisma, ReferralEarningKind } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.module';
import {
  REFERRAL_FROM_LOSS_BPS,
  REFERRAL_FROM_WIN_BPS,
  calcEarningBps,
} from './referrals.constants';

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(private readonly prisma: PrismaService) {}

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

    const rateBps = kind === 'FROM_LOSS' ? REFERRAL_FROM_LOSS_BPS : REFERRAL_FROM_WIN_BPS;
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
    const [user, referralsCount, agg] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { referralCode: true },
      }),
      this.prisma.user.count({ where: { referredById: userId } }),
      this.prisma.referralEarning.aggregate({
        where: { referrerId: userId },
        _sum: { earningMinor: true },
      }),
    ]);
    return {
      referralCode: user?.referralCode ?? '',
      referralsCount,
      totalEarningsMinor: agg._sum.earningMinor ?? 0n,
      rates: {
        fromLossBps: REFERRAL_FROM_LOSS_BPS,
        fromWinBps: REFERRAL_FROM_WIN_BPS,
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
}
