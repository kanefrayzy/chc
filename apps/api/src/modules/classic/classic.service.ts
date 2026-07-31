import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import type { JackpotBet, JackpotRound, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.module';
import { debitBalance } from '../../common/balance';
import { ReferralsService } from '../referrals/referrals.service';
import { RanksService } from '../ranks/ranks.service';
import { SettingsService } from '../settings/settings.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import {
  CLASSIC_DEFAULT_COMMISSION_BPS,
  CLASSIC_DEFAULT_MAX_BET,
  CLASSIC_DEFAULT_MIN_BET,
  CLASSIC_DEFAULT_MIN_PLAYERS,
  CLASSIC_DEFAULT_ROLLING_DURATION_MS,
  CLASSIC_DEFAULT_ROUND_DURATION_SEC,
  calculateClassicPayout,
} from './classic.constants';
import {
  generateClassicPublicSeed,
  generateClassicServerSeed,
  hashClassicServerSeed,
  pickClassicWinningTicket,
} from './classic.rng';
import { toPublicClassicRound, type PublicClassicRoundDto } from './classic.mapper';

/** Сколько ждать, если ставок ещё нет (раунд висит «открыт»). */
const IDLE_FAR_FUTURE_MS = 24 * 60 * 60 * 1000;

interface UserLite {
  id: string;
  username: string;
  avatarUrl: string | null;
}

interface BetWithUser extends JackpotBet {
  user?: UserLite | null;
}

@Injectable()
export class ClassicService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClassicService.name);
  private loopTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  /** Время старта обратного отсчёта в раунде (выставляется при достижении minPlayers). */
  private countdownStartedAt: Date | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly referrals: ReferralsService,
    private readonly ranks: RanksService,
    private readonly settings: SettingsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.CLASSIC_DISABLE_SCHEDULER === '1') {
      this.logger.warn('Classic scheduler disabled via env');
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

  async getActiveRound(): Promise<{
    round: JackpotRound & { winner?: UserLite | null };
    bets: BetWithUser[];
    countdownStartedAt: Date | null;
  } | null> {
    const active = await this.prisma.jackpotRound.findFirst({
      where: { status: { in: ['OPEN', 'ROLLING'] } },
      orderBy: { startedAt: 'desc' },
    });
    if (!active) return null;
    const bets = (await this.prisma.jackpotBet.findMany({
      where: { roundId: active.id },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, username: true, avatarUrl: true } } },
    })) as BetWithUser[];
    let winner: UserLite | null = null;
    if (active.winnerId) {
      winner = await this.prisma.user.findUnique({
        where: { id: active.winnerId },
        select: { id: true, username: true, avatarUrl: true },
      });
    }
    return {
      round: { ...active, winner },
      bets,
      countdownStartedAt: this.countdownStartedAt,
    };
  }

  /**
   * Возвращает активный или последний завершённый раунд (для первичной загрузки страницы).
   */
  async getActiveOrLatestRound(): Promise<{
    round: JackpotRound & { winner?: UserLite | null };
    bets: BetWithUser[];
    countdownStartedAt: Date | null;
  } | null> {
    const active = await this.getActiveRound();
    if (active) return active;
    const last = await this.prisma.jackpotRound.findFirst({
      orderBy: { startedAt: 'desc' },
    });
    if (!last) return null;
    const bets = (await this.prisma.jackpotBet.findMany({
      where: { roundId: last.id },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, username: true, avatarUrl: true } } },
    })) as BetWithUser[];
    let winner: UserLite | null = null;
    if (last.winnerId) {
      winner = await this.prisma.user.findUnique({
        where: { id: last.winnerId },
        select: { id: true, username: true, avatarUrl: true },
      });
    }
    return { round: { ...last, winner }, bets, countdownStartedAt: null };
  }

  async listHistory(limit = 20): Promise<{ round: JackpotRound & { winner?: UserLite | null }; bets: BetWithUser[] }[]> {
    const rounds = await this.prisma.jackpotRound.findMany({
      where: { status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      take: limit,
    });
    if (rounds.length === 0) return [];
    const ids = rounds.map((r) => r.id);
    const allBets = (await this.prisma.jackpotBet.findMany({
      where: { roundId: { in: ids } },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, username: true, avatarUrl: true } } },
    })) as BetWithUser[];
    const winnerIds = rounds.map((r) => r.winnerId).filter((v): v is string => !!v);
    const winners = winnerIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: winnerIds } },
          select: { id: true, username: true, avatarUrl: true },
        })
      : [];
    const winnerById = new Map(winners.map((w) => [w.id, w as UserLite]));
    return rounds.map((r) => ({
      round: { ...r, winner: r.winnerId ? winnerById.get(r.winnerId) ?? null : null },
      bets: allBets.filter((b) => b.roundId === r.id),
    }));
  }

  async listMyBets(userId: string, limit = 30): Promise<JackpotBet[]> {
    return this.prisma.jackpotBet.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async placeBet(params: { userId: string; amountMinor: bigint }): Promise<JackpotBet> {
    const { userId, amountMinor } = params;
    const enabled = await this.settings.get<boolean>('gameplay.jackpot_enabled');
    if (!enabled) {
      throw new BadRequestException('CLASSIC_DISABLED');
    }
    const minBetMinor = BigInt(
      (await this.settings.get<string>('classic.min_bet_minor')) ?? CLASSIC_DEFAULT_MIN_BET.toString(),
    );
    const maxBetMinor = BigInt(
      (await this.settings.get<string>('classic.max_bet_minor')) ?? CLASSIC_DEFAULT_MAX_BET.toString(),
    );
    if (amountMinor < minBetMinor || amountMinor > maxBetMinor) {
      throw new BadRequestException(
        `Bet must be between ${minBetMinor} and ${maxBetMinor} qəpik`,
      );
    }
    const minPlayers =
      (await this.settings.get<number>('classic.min_players_to_start')) ?? CLASSIC_DEFAULT_MIN_PLAYERS;
    const roundDurationSec =
      (await this.settings.get<number>('classic.round_duration_sec')) ?? CLASSIC_DEFAULT_ROUND_DURATION_SEC;

    const result = await this.prisma.$transaction(async (tx) => {
      const round = await tx.jackpotRound.findFirst({
        where: { status: 'OPEN' },
        orderBy: { startedAt: 'desc' },
      });
      if (!round) throw new ConflictException('NO_OPEN_ROUND');
      // Ставка после истечения отсчёта не может выиграть (её билеты выходят за банк,
      // зафиксированный в момент розыгрыша) — не принимаем её вовсе.
      if (round.endsAt && round.endsAt.getTime() <= Date.now()) {
        throw new ConflictException('BETTING_CLOSED');
      }

      // Блокируем строку раунда: выдача диапазонов билетов и рост банка должны быть
      // строго последовательными, иначе диапазоны пересекутся, а часть денег потеряется.
      await tx.$queryRaw`SELECT id FROM "JackpotRound" WHERE id = ${round.id} FOR UPDATE`;
      const locked = await tx.jackpotRound.findUniqueOrThrow({ where: { id: round.id } });
      if (locked.status !== 'OPEN') throw new ConflictException('BETTING_CLOSED');

      // Текущие участники и сумма
      const existingBets = await tx.jackpotBet.findMany({
        where: { roundId: round.id },
        select: { userId: true },
      });
      const uniqueUsersBefore = new Set(existingBets.map((b) => b.userId));
      const isNewParticipant = !uniqueUsersBefore.has(userId);

      const currentBank = locked.bankMinor; // значение под блокировкой строки
      const ticketsFromBig = currentBank; // [0, bank)
      const ticketsToBig = currentBank + amountMinor - 1n;
      // Если bank > 2^31, мы превысим Int. Игровой смысл сохраняется до ~21M AZN банка.
      if (ticketsToBig > 2_147_483_646n) {
        throw new ConflictException('BANK_OVERFLOW');
      }

      const bet = await tx.jackpotBet.create({
        data: {
          roundId: round.id,
          userId,
          amountMinor,
          ticketsFrom: Number(ticketsFromBig),
          ticketsTo: Number(ticketsToBig),
        },
      });

      // Списание с проверкой средств внутри UPDATE — защита от параллельных ставок
      const balanceAfter = await debitBalance(tx, userId, amountMinor, { wager: true });

      await tx.transaction.create({
        data: {
          userId,
          type: 'JACKPOT_BET',
          status: 'COMPLETED',
          amountMinor: -amountMinor,
          balanceAfterMinor: balanceAfter,
          idempotencyKey: `classic:bet:${bet.id}:place`,
          referenceType: 'jackpot_bet',
          referenceId: bet.id,
          description: 'Classic jackpot bet',
        },
      });

      // Обновляем банк раунда (инкрементом — абсолютная запись теряла бы параллельные ставки)
      const uniqueUsersAfter = uniqueUsersBefore.size + (isNewParticipant ? 1 : 0);

      // Если достигли minPlayers и обратный отсчёт ещё не запущен — запустить.
      let updatedRound: JackpotRound = await tx.jackpotRound.update({
        where: { id: round.id },
        data: { bankMinor: { increment: amountMinor } },
      });

      const shouldStartCountdown = !this.countdownStartedAt && uniqueUsersAfter >= minPlayers;
      if (shouldStartCountdown) {
        updatedRound = await tx.jackpotRound.update({
          where: { id: round.id },
          data: { endsAt: new Date(Date.now() + roundDurationSec * 1000) },
        });
      }

      await this.ranks.syncUserRank(userId, tx);

      return { bet, round: updatedRound, startedCountdown: shouldStartCountdown };
    });

    if (result.startedCountdown) {
      this.countdownStartedAt = new Date();
      this.scheduleNextTick(result.round);
    }

    // Эмит «новой ставки» и обновлённого раунда в комнату
    void this.emitState();

    return result.bet;
  }

  // ============== LIFECYCLE ==============

  private async resumeOrStart(): Promise<void> {
    const existing = await this.prisma.jackpotRound.findFirst({
      where: { status: { in: ['OPEN', 'ROLLING'] } },
      orderBy: { startedAt: 'desc' },
    });
    if (existing) {
      this.logger.log(`Resuming classic round ${existing.id} (status=${existing.status})`);
      // Если уже есть ≥ minPlayers — продолжаем счётчик от сохранённого endsAt.
      const uniqueUsers = await this.prisma.jackpotBet
        .findMany({ where: { roundId: existing.id }, select: { userId: true } })
        .then((rows) => new Set(rows.map((r) => r.userId)).size);
      const minPlayers =
        (await this.settings.get<number>('classic.min_players_to_start')) ?? CLASSIC_DEFAULT_MIN_PLAYERS;
      if (existing.status === 'OPEN' && uniqueUsers >= minPlayers) {
        this.countdownStartedAt = new Date(
          existing.endsAt.getTime() -
            ((await this.settings.get<number>('classic.round_duration_sec')) ??
              CLASSIC_DEFAULT_ROUND_DURATION_SEC) *
              1000,
        );
      }
      this.scheduleNextTick(existing);
    } else {
      await this.startNewRound();
    }
  }

  private async startNewRound(): Promise<void> {
    const serverSeed = generateClassicServerSeed();
    const serverSeedHash = hashClassicServerSeed(serverSeed);
    const commissionBps =
      (await this.settings.get<number>('classic.commission_bps')) ?? CLASSIC_DEFAULT_COMMISSION_BPS;
    const round = await this.prisma.jackpotRound.create({
      data: {
        status: 'OPEN',
        serverSeed,
        serverSeedHash,
        commissionRateBps: commissionBps,
        startedAt: new Date(),
        endsAt: new Date(Date.now() + IDLE_FAR_FUTURE_MS),
      },
    });
    this.countdownStartedAt = null;
    this.logger.log(`Started classic round ${round.id}`);
    void this.emitState();
    // Не планируем тик — он будет запланирован при достижении minPlayers.
  }

  private scheduleNextTick(round: JackpotRound): void {
    if (!this.running) return;
    if (this.loopTimer) clearTimeout(this.loopTimer);
    const now = Date.now();
    let delay: number;
    if (round.status === 'OPEN') {
      delay = Math.max(0, round.endsAt.getTime() - now);
    } else if (round.status === 'ROLLING') {
      const rollingMs =
        ((this.cachedRollingSec ?? CLASSIC_DEFAULT_ROLLING_DURATION_MS / 1000) as number) * 1000;
      delay = rollingMs;
    } else {
      delay = 0;
    }
    this.loopTimer = setTimeout(() => {
      void this.tick(round.id).catch((err) => this.logger.error('Classic tick failed', err));
    }, delay);
  }

  private cachedRollingSec: number | null = null;

  private async tick(roundId: string): Promise<void> {
    const round = await this.prisma.jackpotRound.findUnique({ where: { id: roundId } });
    if (!round) {
      await this.startNewRound();
      return;
    }

    if (round.status === 'OPEN') {
      // Проверка количества уникальных игроков
      const bets = await this.prisma.jackpotBet.findMany({
        where: { roundId: round.id },
        select: { userId: true },
      });
      const uniqueUsers = new Set(bets.map((b) => b.userId)).size;
      const minPlayers =
        (await this.settings.get<number>('classic.min_players_to_start')) ?? CLASSIC_DEFAULT_MIN_PLAYERS;
      if (uniqueUsers < minPlayers) {
        // Не должны были тикнуться без countdownStartedAt, но на всякий случай — продлим.
        this.countdownStartedAt = null;
        const extended = await this.prisma.jackpotRound.update({
          where: { id: round.id },
          data: { endsAt: new Date(Date.now() + IDLE_FAR_FUTURE_MS) },
        });
        void this.emitState();
        if (uniqueUsers >= minPlayers) this.scheduleNextTick(extended);
        return;
      }

      // Транзакция в ROLLING: вычисляем publicSeed и winningTicket по уже зафиксированному serverSeed.
      const publicSeed = generateClassicPublicSeed();
      const bank = round.bankMinor;

      // Проверяем принудительный winning user
      let forcedTicket: bigint | null = null;
      const forcedUserId = (await this.settings.get<string>('classic.forced_winner_user_id')) ?? '';
      if (forcedUserId) {
        const forcedBet = await this.prisma.jackpotBet.findFirst({
          where: { roundId: round.id, userId: forcedUserId },
          orderBy: { ticketsFrom: 'asc' },
        });
        if (forcedBet) {
          forcedTicket = BigInt(forcedBet.ticketsFrom);
          await this.settings.set('classic.forced_winner_user_id', '');
          this.logger.log(`Round ${round.id} FORCED winner=${forcedUserId} ticket=${forcedTicket}`);
        } else {
          await this.settings.set('classic.forced_winner_user_id', '');
        }
      }

      const winningTicketBig =
        forcedTicket ?? pickClassicWinningTicket(round.serverSeed!, publicSeed, bank);
      const winningTicket = Number(winningTicketBig);

      // Определяем победителя
      const winnerBet = await this.prisma.jackpotBet.findFirst({
        where: {
          roundId: round.id,
          ticketsFrom: { lte: winningTicket },
          ticketsTo: { gte: winningTicket },
        },
      });
      if (!winnerBet) {
        this.logger.error(`Round ${round.id}: no winning bet for ticket=${winningTicket}, cancelling`);
        await this.cancelRound(round.id);
        await this.startNewRound();
        return;
      }

      const rolling = await this.prisma.jackpotRound.update({
        where: { id: round.id },
        data: {
          status: 'ROLLING',
          publicSeed,
          winningTicket,
          winnerId: winnerBet.userId,
        },
      });
      this.logger.log(
        `Round ${round.id} → ROLLING ticket=${winningTicket}/${bank} winner=${winnerBet.userId}`,
      );
      this.cachedRollingSec =
        (await this.settings.get<number>('classic.rolling_duration_sec')) ??
        CLASSIC_DEFAULT_ROLLING_DURATION_MS / 1000;
      void this.emitState();
      this.scheduleNextTick(rolling);
      return;
    }

    if (round.status === 'ROLLING') {
      await this.settleRound(round);
      await this.startNewRound();
      return;
    }

    await this.startNewRound();
  }

  private async settleRound(round: JackpotRound): Promise<void> {
    if (!round.winnerId || round.winningTicket === null) {
      this.logger.error(`Round ${round.id} missing winner; cancelling`);
      await this.cancelRound(round.id);
      return;
    }
    const commissionBps = round.commissionRateBps;
    const payout = calculateClassicPayout(round.bankMinor, commissionBps);
    const commission = round.bankMinor - payout;
    const winnerId = round.winnerId;

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: winnerId },
        data: { balanceMinor: { increment: payout } },
        select: { balanceMinor: true },
      });
      await tx.transaction.create({
        data: {
          userId: winnerId,
          type: 'JACKPOT_WIN',
          status: 'COMPLETED',
          amountMinor: payout,
          balanceAfterMinor: updated.balanceMinor,
          idempotencyKey: `classic:round:${round.id}:win`,
          referenceType: 'jackpot_round',
          referenceId: round.id,
          description: 'Classic jackpot win',
        },
      });
      // Комиссия — для аудита (без баланса).
      if (commission > 0n) {
        await tx.transaction.create({
          data: {
            userId: winnerId,
            type: 'JACKPOT_COMMISSION',
            status: 'COMPLETED',
            amountMinor: -commission,
            balanceAfterMinor: updated.balanceMinor,
            idempotencyKey: `classic:round:${round.id}:commission`,
            referenceType: 'jackpot_round',
            referenceId: round.id,
            description: `Classic jackpot commission ${commissionBps} bps`,
          },
        });
      }
      // Рефералы: с проигравших — 10% от их вклада (FROM_LOSS).
      const allBets = await tx.jackpotBet.findMany({ where: { roundId: round.id } });
      // Агрегируем по пользователю.
      const byUser = new Map<string, bigint>();
      for (const b of allBets) {
        byUser.set(b.userId, (byUser.get(b.userId) ?? 0n) + b.amountMinor);
      }
      for (const [userId, total] of byUser.entries()) {
        if (userId === winnerId) continue;
        // Проигравший: маржа казино по нему = весь его вклад
        await this.referrals.settleGameMargin({
          referredId: userId,
          marginMinor: total,
          referenceType: 'jackpot_round',
          referenceId: round.id,
          tx: tx as unknown as Prisma.TransactionClient,
        });
      }
      // Победитель: маржа казино отрицательная на величину его чистого выигрыша
      const winnerStake = byUser.get(winnerId) ?? 0n;
      const winnerMargin = winnerStake - payout;
      if (winnerMargin !== 0n) {
        await this.referrals.settleGameMargin({
          referredId: winnerId,
          marginMinor: winnerMargin,
          referenceType: 'jackpot_round',
          referenceId: round.id,
          tx: tx as unknown as Prisma.TransactionClient,
        });
      }
      await tx.jackpotRound.update({
        where: { id: round.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
    });

    this.logger.log(
      `Classic round ${round.id} settled → winner=${winnerId} payout=${payout} commission=${commission}`,
    );
    void this.emitState();
    void this.emitCompleted(round.id);
  }

  private async cancelRound(roundId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const bets = await tx.jackpotBet.findMany({ where: { roundId } });
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
            idempotencyKey: `classic:bet:${bet.id}:refund`,
            referenceType: 'jackpot_bet',
            referenceId: bet.id,
            description: 'Classic round cancelled — refund',
          },
        });
      }
      await tx.jackpotRound.update({
        where: { id: roundId },
        data: { status: 'CANCELLED', completedAt: new Date() },
      });
    });
  }

  // ============== EMITS ==============

  private async emitState(): Promise<void> {
    try {
      const data = await this.getActiveOrLatestRound();
      if (!data) return;
      const dto = toPublicClassicRound(data.round, data.bets, {
        countdownStartedAt: data.countdownStartedAt,
      });
      this.realtime.emitClassic('classic:round', dto);
    } catch (err) {
      this.logger.warn(`Failed to emit classic state: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async emitCompleted(roundId: string): Promise<void> {
    try {
      const round = await this.prisma.jackpotRound.findUnique({ where: { id: roundId } });
      if (!round || !round.winnerId) return;
      const winner = await this.prisma.user.findUnique({
        where: { id: round.winnerId },
        select: { id: true, username: true, avatarUrl: true },
      });
      this.realtime.emitClassic('classic:completed', {
        roundId,
        winnerId: round.winnerId,
        winnerUsername: winner?.username ?? null,
        winnerAvatarUrl: winner?.avatarUrl ?? null,
        bankMinor: round.bankMinor.toString(),
        payoutMinor: calculateClassicPayout(round.bankMinor, round.commissionRateBps).toString(),
        winningTicket: round.winningTicket,
      });
    } catch {
      // ignore
    }
  }

  /** Используется контроллером для маппинга `getActiveOrLatestRound` в DTO. */
  toPublicRound(
    round: JackpotRound & { winner?: UserLite | null },
    bets: BetWithUser[],
    countdownStartedAt: Date | null,
  ): PublicClassicRoundDto {
    return toPublicClassicRound(round, bets, { countdownStartedAt });
  }
}
