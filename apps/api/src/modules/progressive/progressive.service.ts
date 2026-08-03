import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import type { ProgressiveTier, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.module';
import { RealtimeGateway } from '../realtime/realtime.gateway';

/** Порядок отображения копилок — от крупной к мелкой. */
export const PROGRESSIVE_TIERS: ProgressiveTier[] = ['GRAND', 'MAJOR', 'MINOR', 'MINI'];

export interface ProgressiveJackpotView {
  tier: ProgressiveTier;
  currentMinor: bigint;
  enabled: boolean;
  lastWinnerName: string | null;
  lastWinMinor: bigint;
  lastWonAt: Date | null;
}

/**
 * Прогрессивный джекпот: четыре копилки, которые растут с каждой ставки в
 * наших играх. Доля берётся из маржи казино, а не из выплаты игроку —
 * математика самих игр не меняется, меняется только доход дома (ADR-0013).
 *
 * Срыв копилки делает модератор из админки: сумма уходит выбранному игроку,
 * копилка откатывается к стартовому значению `seedMinor`.
 */
@Injectable()
export class ProgressiveService {
  private readonly logger = new Logger(ProgressiveService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async list(): Promise<ProgressiveJackpotView[]> {
    const rows = await this.prisma.progressiveJackpot.findMany();
    const byTier = new Map(rows.map((r) => [r.tier, r]));
    return PROGRESSIVE_TIERS.map((tier) => {
      const row = byTier.get(tier);
      return {
        tier,
        currentMinor: row?.currentMinor ?? 0n,
        enabled: row?.enabled ?? false,
        lastWinnerName: row?.lastWinnerName ?? null,
        lastWinMinor: row?.lastWinMinor ?? 0n,
        lastWonAt: row?.lastWonAt ?? null,
      };
    });
  }

  /** Полные настройки — только для админки. */
  async listAdmin() {
    const rows = await this.prisma.progressiveJackpot.findMany();
    const byTier = new Map(rows.map((r) => [r.tier, r]));
    return PROGRESSIVE_TIERS.map((tier) => {
      const row = byTier.get(tier);
      return {
        tier,
        seedMinor: row?.seedMinor ?? 0n,
        currentMinor: row?.currentMinor ?? 0n,
        contributionBps: row?.contributionBps ?? 0,
        enabled: row?.enabled ?? false,
        lastWinnerName: row?.lastWinnerName ?? null,
        lastWinMinor: row?.lastWinMinor ?? 0n,
        lastWonAt: row?.lastWonAt ?? null,
      };
    });
  }

  /**
   * Отчисление со ставки. Вызывается из игр после успешного приёма ставки и
   * НЕ должно ронять саму ставку — поэтому ошибки только логируются.
   */
  async contribute(betMinor: bigint): Promise<void> {
    if (betMinor <= 0n) return;
    try {
      const pools = await this.prisma.progressiveJackpot.findMany({
        where: { enabled: true, contributionBps: { gt: 0 } },
      });
      if (pools.length === 0) return;

      let changed = false;
      for (const pool of pools) {
        // Округление вниз: копилка никогда не растёт быстрее, чем реально отчислено
        const add = (betMinor * BigInt(pool.contributionBps)) / 10_000n;
        if (add <= 0n) continue;
        await this.prisma.progressiveJackpot.update({
          where: { tier: pool.tier },
          data: { currentMinor: { increment: add } },
        });
        changed = true;
      }
      if (changed) void this.emitState();
    } catch (e) {
      this.logger.warn(`Не удалось пополнить джекпот со ставки ${betMinor}: ${String(e)}`);
    }
  }

  async updateSettings(
    tier: ProgressiveTier,
    data: {
      seedMinor?: bigint;
      currentMinor?: bigint;
      contributionBps?: number;
      enabled?: boolean;
    },
  ) {
    const patch: Prisma.ProgressiveJackpotUpdateInput = {};
    if (data.seedMinor !== undefined) patch.seedMinor = data.seedMinor;
    if (data.currentMinor !== undefined) patch.currentMinor = data.currentMinor;
    if (data.contributionBps !== undefined) patch.contributionBps = data.contributionBps;
    if (data.enabled !== undefined) patch.enabled = data.enabled;

    const row = await this.prisma.progressiveJackpot.upsert({
      where: { tier },
      update: patch,
      create: {
        tier,
        seedMinor: data.seedMinor ?? 0n,
        currentMinor: data.currentMinor ?? data.seedMinor ?? 0n,
        contributionBps: data.contributionBps ?? 0,
        enabled: data.enabled ?? true,
      },
    });
    void this.emitState();
    return row;
  }

  /**
   * Срыв копилки: вся накопленная сумма уходит игроку, копилка откатывается
   * к `seedMinor`. Всё в одной транзакции — двойная выдача невозможна, потому
   * что копилка обнуляется условным апдейтом по текущему значению.
   */
  async award(params: { tier: ProgressiveTier; userId: string; moderatorId?: string }) {
    const { tier, userId, moderatorId } = params;

    return this.prisma.$transaction(async (tx) => {
      const pool = await tx.progressiveJackpot.findUnique({ where: { tier } });
      if (!pool) throw new NotFoundException('JACKPOT_NOT_FOUND');
      if (pool.currentMinor <= 0n) throw new BadRequestException('JACKPOT_EMPTY');

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true },
      });
      if (!user) throw new NotFoundException('USER_NOT_FOUND');

      const amount = pool.currentMinor;

      // Условный сброс: если параллельный вызов уже забрал копилку,
      // count будет 0 и выплаты не произойдёт.
      const claimed = await tx.progressiveJackpot.updateMany({
        where: { tier, currentMinor: amount },
        data: {
          currentMinor: pool.seedMinor,
          lastWonAt: new Date(),
          lastWinnerName: user.username,
          lastWinMinor: amount,
        },
      });
      if (claimed.count !== 1) throw new BadRequestException('JACKPOT_ALREADY_AWARDED');

      const win = await tx.progressiveJackpotWin.create({
        data: {
          tier,
          userId,
          amountMinor: amount,
          awardedByModeratorId: moderatorId ?? null,
        },
      });

      const updated = await tx.user.update({
        where: { id: userId },
        data: { balanceMinor: { increment: amount } },
        select: { balanceMinor: true },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'PROGRESSIVE_WIN',
          status: 'COMPLETED',
          amountMinor: amount,
          balanceAfterMinor: updated.balanceMinor,
          idempotencyKey: `progressive:${win.id}`,
          referenceType: 'progressive_win',
          referenceId: win.id,
          description: `Прогрессивный джекпот ${tier}`,
        },
      });

      this.logger.log(`Джекпот ${tier} ${amount} → ${user.username} (${userId})`);

      void this.emitState();
      this.realtime.emitAll('progressive:won', {
        tier,
        username: user.username,
        amountMinor: amount.toString(),
        createdAt: win.createdAt.toISOString(),
      });

      return { id: win.id, tier, amountMinor: amount, username: user.username };
    });
  }

  /** Последние срывы — для витрины «последний крупный выигрыш». */
  async recentWins(limit = 5) {
    return this.prisma.progressiveJackpotWin.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 20),
      include: { user: { select: { username: true } } },
    });
  }

  private async emitState(): Promise<void> {
    try {
      const items = await this.list();
      this.realtime.emitAll('progressive:state', {
        items: items.map((i) => ({
          tier: i.tier,
          currentMinor: i.currentMinor.toString(),
          enabled: i.enabled,
        })),
      });
    } catch {
      /* витрина — не критично */
    }
  }
}
