import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import type { RouletteBet, RouletteColor, RouletteRound } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.module';
import { ReferralsService } from '../referrals/referrals.service';
import {
  ROULETTE_TOTAL_SLOTS,
  calculatePayout,
  slotToColor,
} from './roulette.constants';
import {
  generatePublicSeed,
  generateServerSeed,
  hashServerSeed,
  pickSlot,
} from './roulette.rng';

const BETTING_DURATION_MS = Number(process.env.ROULETTE_BETTING_MS || 20_000);
const ROLLING_DURATION_MS = Number(process.env.ROULETTE_ROLLING_MS || 5_000);
const DEFAULT_MIN_BET = 100n;
const DEFAULT_MAX_BET = 100_000n;

@Injectable()
export class RouletteService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RouletteService.name);
  private readonly minBetMinor: bigint;
  private readonly maxBetMinor: bigint;
  private loopTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly referrals: ReferralsService,
  ) {
    this.minBetMinor = BigInt(process.env.ROULETTE_MIN_BET_MINOR || DEFAULT_MIN_BET.toString());
    this.maxBetMinor = BigInt(process.env.ROULETTE_MAX_BET_MINOR || DEFAULT_MAX_BET.toString());
  }

  async onModuleInit(): Promise<void> {
    if (process.env.ROULETTE_DISABLE_SCHEDULER === '1') {
      this.logger.warn('Roulette scheduler disabled via env');
      return;
    }
    this.running = true;
    await this.resumeOrStart();
  }

  onModuleDestroy(): void {
    this.running = false;
    if (this.loopTimer) clearTimeout(this.loopTimer);
  }

  // ============== PUBLIC API ==============

  async getActiveOrLatestRound(): Promise<{ round: RouletteRound; bets: RouletteBet[] } | null> {
    const active = await this.prisma.rouletteRound.findFirst({
      where: { status: { in: ['BETTING', 'ROLLING'] } },
      orderBy: { startedAt: 'desc' },
    });
    const round = active ?? (await this.prisma.rouletteRound.findFirst({ orderBy: { startedAt: 'desc' } }));
    if (!round) return null;
    const bets = await this.prisma.rouletteBet.findMany({ where: { roundId: round.id } });
    return { round, bets };
  }

  async listRecentBets(roundId: string, limit = 50): Promise<RouletteBet[]> {
    return this.prisma.rouletteBet.findMany({
      where: { roundId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { username: true } } } as never,
    });
  }

  async listHistory(limit = 20): Promise<RouletteRound[]> {
    return this.prisma.rouletteRound.findMany({
      where: { status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      take: limit,
    });
  }

  async listMyBets(userId: string, limit = 30): Promise<RouletteBet[]> {
    return this.prisma.rouletteBet.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async placeBet(params: {
    userId: string;
    color: RouletteColor;
    amountMinor: bigint;
  }): Promise<RouletteBet> {
    const { userId, color, amountMinor } = params;
    if (amountMinor < this.minBetMinor || amountMinor > this.maxBetMinor) {
      throw new BadRequestException(
        `Bet must be between ${this.minBetMinor} and ${this.maxBetMinor} qəpik`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const round = await tx.rouletteRound.findFirst({
        where: { status: 'BETTING' },
        orderBy: { startedAt: 'desc' },
      });
      if (!round) throw new ConflictException('NO_OPEN_ROUND');
      if (round.bettingEndsAt.getTime() <= Date.now()) {
        throw new ConflictException('BETTING_CLOSED');
      }

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { balanceMinor: true },
      });
      if (!user) throw new NotFoundException('USER_NOT_FOUND');
      if (user.balanceMinor < amountMinor) throw new ConflictException('INSUFFICIENT_FUNDS');

      const bet = await tx.rouletteBet.create({
        data: { roundId: round.id, userId, color, amountMinor },
      });

      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          balanceMinor: { decrement: amountMinor },
          totalWageredMinor: { increment: amountMinor },
        },
        select: { balanceMinor: true },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'BET_PLACE',
          status: 'COMPLETED',
          amountMinor: -amountMinor,
          balanceAfterMinor: updated.balanceMinor,
          idempotencyKey: `bet:${bet.id}:place`,
          referenceType: 'roulette_bet',
          referenceId: bet.id,
          description: `Roulette bet on ${color}`,
        },
      });

      return bet;
    });
  }

  // ============== LIFECYCLE ==============

  private async resumeOrStart(): Promise<void> {
    const existing = await this.prisma.rouletteRound.findFirst({
      where: { status: { in: ['BETTING', 'ROLLING'] } },
      orderBy: { startedAt: 'desc' },
    });
    if (existing) {
      this.logger.log(`Resuming roulette round ${existing.id} (status=${existing.status})`);
      this.scheduleNextTick(existing);
    } else {
      await this.startNewRound();
    }
  }

  private async startNewRound(): Promise<void> {
    const serverSeed = generateServerSeed();
    const serverSeedHash = hashServerSeed(serverSeed);
    const now = Date.now();
    const round = await this.prisma.rouletteRound.create({
      data: {
        status: 'BETTING',
        serverSeed,
        serverSeedHash,
        startedAt: new Date(now),
        bettingEndsAt: new Date(now + BETTING_DURATION_MS),
      },
    });
    this.logger.log(`Started roulette round ${round.id}`);
    this.scheduleNextTick(round);
  }

  private scheduleNextTick(round: RouletteRound): void {
    if (!this.running) return;
    if (this.loopTimer) clearTimeout(this.loopTimer);
    const now = Date.now();
    let delay: number;
    if (round.status === 'BETTING') {
      delay = Math.max(0, round.bettingEndsAt.getTime() - now);
    } else if (round.status === 'ROLLING') {
      delay = ROLLING_DURATION_MS;
    } else {
      delay = 0;
    }
    this.loopTimer = setTimeout(() => {
      void this.tick(round.id).catch((err) => this.logger.error('Roulette tick failed', err));
    }, delay);
  }

  private async tick(roundId: string): Promise<void> {
    const round = await this.prisma.rouletteRound.findUnique({ where: { id: roundId } });
    if (!round) {
      await this.startNewRound();
      return;
    }

    if (round.status === 'BETTING') {
      const rolling = await this.prisma.rouletteRound.update({
        where: { id: round.id },
        data: { status: 'ROLLING', publicSeed: generatePublicSeed() },
      });
      this.logger.log(`Round ${round.id} → ROLLING`);
      this.scheduleNextTick(rolling);
      return;
    }

    if (round.status === 'ROLLING') {
      await this.settleRound(round);
      await this.startNewRound();
      return;
    }

    // COMPLETED/CANCELLED → новый
    await this.startNewRound();
  }

  private async settleRound(round: RouletteRound): Promise<void> {
    if (!round.serverSeed || !round.publicSeed) {
      this.logger.error(`Round ${round.id} missing seeds; cancelling`);
      await this.cancelRound(round.id);
      return;
    }
    const slot = pickSlot(round.serverSeed, round.publicSeed, ROULETTE_TOTAL_SLOTS);
    const color = slotToColor(slot);

    await this.prisma.$transaction(async (tx) => {
      const allBets = await tx.rouletteBet.findMany({
        where: { roundId: round.id },
      });
      for (const bet of allBets) {
        if (bet.color === color) {
          const payout = calculatePayout(bet.amountMinor, color);
          const updated = await tx.user.update({
            where: { id: bet.userId },
            data: { balanceMinor: { increment: payout } },
            select: { balanceMinor: true },
          });
          await tx.rouletteBet.update({
            where: { id: bet.id },
            data: { isWinner: true, payoutMinor: payout },
          });
          await tx.transaction.create({
            data: {
              userId: bet.userId,
              type: 'BET_WIN',
              status: 'COMPLETED',
              amountMinor: payout,
              balanceAfterMinor: updated.balanceMinor,
              idempotencyKey: `bet:${bet.id}:win`,
              referenceType: 'roulette_bet',
              referenceId: bet.id,
              description: `Roulette win on ${color}`,
            },
          });
          // Реферал: 3% от чистого выигрыша (payout - ставка)
          const netWin = payout - bet.amountMinor;
          if (netWin > 0n) {
            await this.referrals.creditEarning({
              referredId: bet.userId,
              kind: 'FROM_WIN',
              sourceAmountMinor: netWin,
              referenceType: 'roulette_bet',
              referenceId: bet.id,
              tx,
            });
          }
        } else {
          // Реферал: 10% от проигранной ставки
          await this.referrals.creditEarning({
            referredId: bet.userId,
            kind: 'FROM_LOSS',
            sourceAmountMinor: bet.amountMinor,
            referenceType: 'roulette_bet',
            referenceId: bet.id,
            tx,
          });
        }
      }

      await tx.rouletteRound.update({
        where: { id: round.id },
        data: {
          status: 'COMPLETED',
          winningSlot: slot,
          winningColor: color,
          completedAt: new Date(),
        },
      });
    });

    this.logger.log(`Round ${round.id} settled → slot=${slot} color=${color}`);
  }

  private async cancelRound(roundId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const bets = await tx.rouletteBet.findMany({ where: { roundId } });
      for (const bet of bets) {
        const updated = await tx.user.update({
          where: { id: bet.userId },
          data: { balanceMinor: { increment: bet.amountMinor } },
          select: { balanceMinor: true },
        });
        await tx.transaction.create({
          data: {
            userId: bet.userId,
            type: 'BET_REFUND',
            status: 'COMPLETED',
            amountMinor: bet.amountMinor,
            balanceAfterMinor: updated.balanceMinor,
            idempotencyKey: `bet:${bet.id}:refund`,
            referenceType: 'roulette_bet',
            referenceId: bet.id,
            description: 'Roulette round cancelled — refund',
          },
        });
      }
      await tx.rouletteRound.update({
        where: { id: roundId },
        data: { status: 'CANCELLED', completedAt: new Date() },
      });
    });
  }
}
