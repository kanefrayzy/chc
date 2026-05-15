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
import { RanksService } from '../ranks/ranks.service';
import { SettingsService } from '../settings/settings.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
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

const BETTING_DURATION_MS = Number(process.env.ROULETTE_BETTING_MS || 30_000);
// ROLLING-\u0444\u0430\u0437\u0430 \u043d\u0430 \u0431\u044d\u043a\u0435 \u043a\u043e\u0440\u043e\u0442\u043a\u0430\u044f: \u0432\u0438\u0437\u0443\u0430\u043b\u044c\u043d\u0443\u044e \u0438\u043d\u0442\u0440\u0438\u0433\u0443 (~10\u0441) \u0440\u0438\u0441\u0443\u0435\u0442 \u0444\u0440\u043e\u043d\u0442 \u043f\u043e \u0444\u0438\u043a\u0441\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u043e\u043c\u0443 winningSlot.
const ROLLING_DURATION_MS = Number(process.env.ROULETTE_ROLLING_MS || 10_500);
const DEFAULT_MIN_BET = 100n;
const DEFAULT_MAX_BET = 100_000n;

@Injectable()
export class RouletteService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RouletteService.name);
  private loopTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly referrals: ReferralsService,
    private readonly ranks: RanksService,
    private readonly settings: SettingsService,
    private readonly realtime: RealtimeGateway,
  ) {
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

  private emitRound(round: RouletteRound): void {
    try {
      this.realtime.emitRoulette('roulette:round', {
        id: round.id,
        status: round.status,
        startedAt: round.startedAt.toISOString(),
        bettingEndsAt: round.bettingEndsAt.toISOString(),
        serverSeedHash: round.serverSeedHash,
        publicSeed: round.publicSeed,
        winningSlot: round.winningSlot,
        winningColor: round.winningColor,
        completedAt: round.completedAt?.toISOString() ?? null,
      });
    } catch {
      // не блокируем игровой цикл
    }
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

  async listRecentWinners(
    limit = 5,
  ): Promise<{ username: string; amountMinor: string; color: RouletteColor; createdAt: string }[]> {
    // Берём больше строк чтобы после агрегации осталось нужное количество
    const rows = await this.prisma.rouletteBet.findMany({
      where: { isWinner: true, payoutMinor: { gt: 0n } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit * 20, 200),
      include: { user: { select: { username: true } } } as never,
    });

    // Группируем по (userId, roundId) — суммируем выигрыши
    type WinEntry = { username: string; amountMinor: bigint; color: RouletteColor; createdAt: Date };
    const groups = new Map<string, WinEntry>();
    for (const b of rows) {
      const username =
        (b as RouletteBet & { user?: { username: string } }).user?.username ?? 'player';
      const key = `${b.userId}|${b.roundId}`;
      if (!groups.has(key)) {
        groups.set(key, { username, amountMinor: 0n, color: b.color, createdAt: b.createdAt });
      }
      groups.get(key)!.amountMinor += b.payoutMinor ?? 0n;
    }

    return [...groups.values()]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .map((e) => ({
        username: e.username,
        amountMinor: e.amountMinor.toString(),
        color: e.color,
        createdAt: e.createdAt.toISOString(),
      }));
  }

  async placeBet(params: {
    userId: string;
    color: RouletteColor;
    amountMinor: bigint;
  }): Promise<RouletteBet> {
    const { userId, color, amountMinor } = params;
    const enabled = await this.settings.get<boolean>('gameplay.roulette_enabled');
    if (!enabled) {
      throw new BadRequestException('ROULETTE_DISABLED');
    }
    const minBetMinor = BigInt((await this.settings.get<string>('roulette.min_bet_minor')) ?? DEFAULT_MIN_BET.toString());
    const maxBetMinor = BigInt((await this.settings.get<string>('roulette.max_bet_minor')) ?? DEFAULT_MAX_BET.toString());
    if (amountMinor < minBetMinor || amountMinor > maxBetMinor) {
      throw new BadRequestException(
        `Bet must be between ${minBetMinor} and ${maxBetMinor} qəpik`,
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

      // Правило комбинации ставок: максимум 2 цвета из пар RED+GREEN или BLACK+GREEN.
      // Нельзя ставить одновременно на RED и BLACK.
      const myBets = await tx.rouletteBet.findMany({
        where: { roundId: round.id, userId },
        select: { color: true },
      });
      const myColors = new Set(myBets.map((b) => b.color));
      myColors.add(color);
      if (myColors.has('RED') && myColors.has('BLACK')) {
        throw new ConflictException('INVALID_BET_COMBINATION');
      }

      const isFirstBetInRound = (await tx.rouletteBet.count({ where: { roundId: round.id } })) === 0;

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

      // Обновляем ранг по росту totalWageredMinor.
      await this.ranks.syncUserRank(userId, tx);

      // Если это первая ставка в раунде — сбросить таймер на BETTING_DURATION_MS (30с по умолчанию),
      // чтобы при добавлении первого игрока всем хватило времени подключиться.
      if (isFirstBetInRound) {
        const updated = await tx.rouletteRound.update({
          where: { id: round.id },
          data: { bettingEndsAt: new Date(Date.now() + BETTING_DURATION_MS) },
        });
        // Перепланируем тик и разошлём обновление (вне транзакции — через setImmediate).
        setImmediate(() => {
          this.emitRound(updated);
          this.scheduleNextTick(updated);
        });
      }

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
    this.emitRound(round);
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
      // Если нет ни одной ставки — продлеваем фазу приёма ставок (раунд без участников не крутим).
      const betsCount = await this.prisma.rouletteBet.count({ where: { roundId: round.id } });
      if (betsCount === 0) {
        const extended = await this.prisma.rouletteRound.update({
          where: { id: round.id },
          data: { bettingEndsAt: new Date(Date.now() + BETTING_DURATION_MS) },
        });
        this.logger.log(`Round ${round.id} extended: no bets, waiting for participants`);
        this.emitRound(extended);
        this.scheduleNextTick(extended);
        return;
      }
      // Рассчитываем результат сразу при старте ROLLING, чтобы клиент мог
      // анимировать барабан с реальным winningSlot, не дожидаясь COMPLETED.
      // Выплаты происходят только при COMPLETED (после окончания анимации).
      const publicSeed = generatePublicSeed();
      const serverSeed = round.serverSeed!;
      const earlySlot = pickSlot(serverSeed, publicSeed, ROULETTE_TOTAL_SLOTS);
      const earlyColor = slotToColor(earlySlot);
      const rolling = await this.prisma.rouletteRound.update({
        where: { id: round.id },
        data: { status: 'ROLLING', publicSeed, winningSlot: earlySlot, winningColor: earlyColor },
      });
      this.logger.log(`Round ${round.id} → ROLLING slot=${earlySlot} color=${earlyColor}`);
      this.emitRound(rolling);
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
    // winningSlot и winningColor уже рассчитаны и сохранены при переходе в ROLLING.
    // settleRound только обрабатывает выплаты по известному результату.
    if (round.winningSlot === null || round.winningSlot === undefined || !round.winningColor) {
      this.logger.error(`Round ${round.id} missing winningSlot/winningColor; cancelling`);
      await this.cancelRound(round.id);
      return;
    }
    const slot = round.winningSlot;
    const color = round.winningColor;

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
    const completed = await this.prisma.rouletteRound.findUnique({ where: { id: round.id } });
    if (completed) this.emitRound(completed);

    // Эмитим список последних победителей, чтобы лендинг мог обновляться в реальном времени.
    try {
      const winners = await this.listRecentWinners(5);
      this.realtime.emitRoulette('roulette:winners', { items: winners });
    } catch {
      // не блокируем игровой цикл
    }
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
