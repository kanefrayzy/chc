import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { MinesGame, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.module';
import { ReferralsService } from '../referrals/referrals.service';
import { RanksService } from '../ranks/ranks.service';
import { SettingsService } from '../settings/settings.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { RouletteService } from '../roulette/roulette.service';
import {
  MINES_DEFAULT_HOUSE_EDGE_BPS,
  MINES_MAX_MINES,
  MINES_MIN_MINES,
  MINES_TOTAL_TILES,
  calculateMinesPayout,
  multiplierBps,
} from './mines.constants';
import {
  generateMinesClientSeed,
  generateMinesLayout,
  generateMinesServerSeed,
  hashMinesServerSeed,
} from './mines.rng';
import { toPublicMinesGame, type PublicMinesGameDto } from './mines.mapper';

const DEFAULT_MIN_BET = 100n; // 1.00 AZN
const DEFAULT_MAX_BET = 100_000n; // 1000.00 AZN

@Injectable()
export class MinesService {
  private readonly logger = new Logger(MinesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly referrals: ReferralsService,
    private readonly ranks: RanksService,
    private readonly settings: SettingsService,
    private readonly realtime: RealtimeGateway,
    private readonly roulette: RouletteService,
  ) {}

  // ────────────────────────── PUBLIC API ──────────────────────────

  /** Текущая активная игра пользователя, либо null. */
  async getActive(userId: string): Promise<MinesGame | null> {
    return this.prisma.minesGame.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { startedAt: 'desc' },
    });
  }

  async getActiveOrLatest(userId: string): Promise<MinesGame | null> {
    const active = await this.getActive(userId);
    if (active) return active;
    return this.prisma.minesGame.findFirst({
      where: { userId },
      orderBy: { startedAt: 'desc' },
    });
  }

  async listHistory(userId: string, limit = 30): Promise<MinesGame[]> {
    return this.prisma.minesGame.findMany({
      where: { userId, status: { in: ['CASHED_OUT', 'BUSTED', 'CANCELLED'] } },
      orderBy: { completedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  async getPublicLimits(): Promise<{
    minBetMinor: string;
    maxBetMinor: string;
    minMines: number;
    maxMines: number;
    totalTiles: number;
  }> {
    const [minBet, maxBet] = await Promise.all([
      this.settings.get<string>('mines.min_bet_minor').catch(() => DEFAULT_MIN_BET.toString()),
      this.settings.get<string>('mines.max_bet_minor').catch(() => DEFAULT_MAX_BET.toString()),
    ]);
    return {
      minBetMinor: minBet ?? DEFAULT_MIN_BET.toString(),
      maxBetMinor: maxBet ?? DEFAULT_MAX_BET.toString(),
      minMines: MINES_MIN_MINES,
      maxMines: MINES_MAX_MINES,
      totalTiles: MINES_TOTAL_TILES,
    };
  }

  /**
   * Старт новой игры. Списывает ставку с баланса, генерирует серверный сид
   * и расположение мин. Только одна активная игра на пользователя — гарантируется
   * частичным UNIQUE-индексом в БД (см. миграцию).
   */
  async start(params: {
    userId: string;
    amountMinor: bigint;
    mineCount: number;
    clientSeed?: string;
  }): Promise<PublicMinesGameDto> {
    const { userId, amountMinor, mineCount } = params;

    if (!(await this.isEnabled())) {
      throw new BadRequestException('MINES_DISABLED');
    }
    if (
      !Number.isInteger(mineCount) ||
      mineCount < MINES_MIN_MINES ||
      mineCount > MINES_MAX_MINES
    ) {
      throw new BadRequestException('INVALID_MINE_COUNT');
    }

    const [minBet, maxBet, houseEdgeBps] = await Promise.all([
      this.getMinBetMinor(),
      this.getMaxBetMinor(),
      this.getHouseEdgeBps(),
    ]);
    if (amountMinor < minBet || amountMinor > maxBet) {
      throw new BadRequestException(
        `Bet must be between ${minBet} and ${maxBet} qəpik`,
      );
    }

    const clientSeed = sanitizeClientSeed(params.clientSeed) ?? generateMinesClientSeed();
    const serverSeed = generateMinesServerSeed();
    const serverSeedHash = hashMinesServerSeed(serverSeed);
    const minePositions = generateMinesLayout(serverSeed, clientSeed, 0, mineCount);

    const game = await this.prisma.$transaction(async (tx) => {
      // Любая попытка создать вторую активную игру упрётся в UNIQUE-индекс
      // и упадёт с P2002 — превратим в осмысленную ошибку.
      const existing = await tx.minesGame.findFirst({
        where: { userId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (existing) throw new ConflictException('GAME_ALREADY_ACTIVE');

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { balanceMinor: true },
      });
      if (!user) throw new NotFoundException('USER_NOT_FOUND');
      if (user.balanceMinor < amountMinor) throw new ConflictException('INSUFFICIENT_FUNDS');

      const created = await tx.minesGame.create({
        data: {
          userId,
          status: 'ACTIVE',
          betMinor: amountMinor,
          mineCount,
          serverSeed,
          serverSeedHash,
          clientSeed,
          nonce: 0,
          minePositions,
          revealedTiles: [],
          multiplierBps: 10_000,
          payoutMinor: 0n,
        },
      });

      const updatedUser = await tx.user.update({
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
          balanceAfterMinor: updatedUser.balanceMinor,
          idempotencyKey: `mines:${created.id}:place`,
          referenceType: 'mines_game',
          referenceId: created.id,
          description: `Mines bet (${mineCount} mines)`,
        },
      });

      await this.ranks.syncUserRank(userId, tx);

      return created;
    }).catch((err: unknown) => {
      // Конкурентный старт двух игр из двух вкладок — UNIQUE-индекс гарантирует
      // что выживет ровно одна, второй вернётся понятная ошибка.
      if (isPrismaUniqueViolation(err)) {
        throw new ConflictException('GAME_ALREADY_ACTIVE');
      }
      throw err;
    });

    const dto = toPublicMinesGame(game, houseEdgeBps);
    this.emitState(userId, dto);
    return dto;
  }

  /**
   * Открыть клетку. Если в ней мина — игра проиграна (BUSTED), ставка теряется.
   * Если безопасная — добавляется в revealedTiles, множитель растёт.
   * При открытии последней безопасной клетки — автокешаут.
   */
  async reveal(params: { userId: string; tile: number }): Promise<PublicMinesGameDto> {
    const { userId, tile } = params;
    if (!Number.isInteger(tile) || tile < 0 || tile >= MINES_TOTAL_TILES) {
      throw new BadRequestException('INVALID_TILE');
    }

    const houseEdgeBps = await this.getHouseEdgeBps();

    const dto = await this.prisma.$transaction(async (tx) => {
      const game = await tx.minesGame.findFirst({
        where: { userId, status: 'ACTIVE' },
        orderBy: { startedAt: 'desc' },
      });
      if (!game) throw new NotFoundException('NO_ACTIVE_GAME');

      if (game.revealedTiles.includes(tile)) {
        throw new ConflictException('TILE_ALREADY_REVEALED');
      }

      const isMine = game.minePositions.includes(tile);

      if (isMine) {
        // BUSTED — ставка уже списана при старте, рефералы получают свои %
        // от лосса; апдейтим итог.
        const busted = await tx.minesGame.update({
          where: { id: game.id },
          data: {
            status: 'BUSTED',
            multiplierBps: 0,
            payoutMinor: 0n,
            // фиксируем, что игрок «успел открыть до взрыва»: не помещаем мину
            // в revealedTiles (revealedTiles — только безопасные). UI покажет
            // взорвавшуюся клетку через minePositions + tile.
            completedAt: new Date(),
          },
        });
        await this.referrals.creditEarning({
          referredId: userId,
          kind: 'FROM_LOSS',
          sourceAmountMinor: game.betMinor,
          referenceType: 'mines_game',
          referenceId: game.id,
          tx,
        });
        return toPublicMinesGame(busted, houseEdgeBps);
      }

      // Безопасная клетка
      const newRevealed = [...game.revealedTiles, tile];
      const safeTiles = MINES_TOTAL_TILES - game.mineCount;
      const newMultBps = multiplierBps(game.mineCount, newRevealed.length, houseEdgeBps);

      // Если открыты все безопасные — автокешаут
      if (newRevealed.length >= safeTiles) {
        const payout = calculateMinesPayout(game.betMinor, newMultBps);
        const completed = await this.cashOutInTx(tx, game, newRevealed, newMultBps, payout);
        return toPublicMinesGame(completed, houseEdgeBps);
      }

      const updated = await tx.minesGame.update({
        where: { id: game.id },
        data: { revealedTiles: newRevealed, multiplierBps: newMultBps },
      });
      return toPublicMinesGame(updated, houseEdgeBps);
    });

    this.emitState(userId, dto);
    if (dto.status === 'CASHED_OUT') {
      void this.emitRecentWinners();
    }
    return dto;
  }

  /** Забрать выигрыш по текущему множителю. Требуется минимум одна открытая клетка. */
  async cashout(params: { userId: string }): Promise<PublicMinesGameDto> {
    const { userId } = params;
    const houseEdgeBps = await this.getHouseEdgeBps();

    const dto = await this.prisma.$transaction(async (tx) => {
      const game = await tx.minesGame.findFirst({
        where: { userId, status: 'ACTIVE' },
        orderBy: { startedAt: 'desc' },
      });
      if (!game) throw new NotFoundException('NO_ACTIVE_GAME');
      if (game.revealedTiles.length === 0) {
        throw new ConflictException('NO_REVEALED_TILES');
      }

      const multBps = multiplierBps(game.mineCount, game.revealedTiles.length, houseEdgeBps);
      const payout = calculateMinesPayout(game.betMinor, multBps);
      const completed = await this.cashOutInTx(tx, game, game.revealedTiles, multBps, payout);
      return toPublicMinesGame(completed, houseEdgeBps);
    });

    this.emitState(userId, dto);
    if (dto.status === 'CASHED_OUT') {
      void this.emitRecentWinners();
    }
    return dto;
  }

  // ────────────────────────── PRIVATE ──────────────────────────

  private async cashOutInTx(
    tx: Prisma.TransactionClient,
    game: MinesGame,
    revealedTiles: number[],
    multBps: number,
    payoutMinor: bigint,
  ): Promise<MinesGame> {
    const completed = await tx.minesGame.update({
      where: { id: game.id },
      data: {
        status: 'CASHED_OUT',
        revealedTiles,
        multiplierBps: multBps,
        payoutMinor,
        completedAt: new Date(),
      },
    });

    if (payoutMinor > 0n) {
      const updatedUser = await tx.user.update({
        where: { id: game.userId },
        data: { balanceMinor: { increment: payoutMinor } },
        select: { balanceMinor: true },
      });
      await tx.transaction.create({
        data: {
          userId: game.userId,
          type: 'BET_WIN',
          status: 'COMPLETED',
          amountMinor: payoutMinor,
          balanceAfterMinor: updatedUser.balanceMinor,
          idempotencyKey: `mines:${game.id}:win`,
          referenceType: 'mines_game',
          referenceId: game.id,
          description: `Mines cashout (${revealedTiles.length} picks, ${game.mineCount} mines)`,
        },
      });
    }

    // Реферальные начисления: GGR = bet - payout.
    // Если payout > bet → игрок в плюсе, начисляем 3% от чистого выигрыша.
    // Если payout < bet → казино в плюсе, начисляем 10% от лосса.
    // Если payout == bet → ничего не начисляем.
    const netForCasino = game.betMinor - payoutMinor;
    if (netForCasino > 0n) {
      await this.referrals.creditEarning({
        referredId: game.userId,
        kind: 'FROM_LOSS',
        sourceAmountMinor: netForCasino,
        referenceType: 'mines_game',
        referenceId: game.id,
        tx,
      });
    } else if (netForCasino < 0n) {
      await this.referrals.creditEarning({
        referredId: game.userId,
        kind: 'FROM_WIN',
        sourceAmountMinor: -netForCasino,
        referenceType: 'mines_game',
        referenceId: game.id,
        tx,
      });
    }

    return completed;
  }

  private emitState(userId: string, dto: PublicMinesGameDto): void {
    try {
      this.realtime.emitToUser(userId, 'mines:state', dto);
    } catch {
      // не блокируем основной поток
    }
  }

  private async emitRecentWinners(): Promise<void> {
    try {
      const items = await this.roulette.listRecentWinners(5);
      this.realtime.emitRoulette('roulette:winners', { items });
    } catch {
      // не блокируем игровой цикл
    }
  }

  private async isEnabled(): Promise<boolean> {
    try {
      const v = await this.settings.get<boolean>('gameplay.mines_enabled');
      return v !== false;
    } catch {
      return true;
    }
  }

  private async getMinBetMinor(): Promise<bigint> {
    const v = await this.settings.get<string>('mines.min_bet_minor').catch(() => null);
    return v ? BigInt(v) : DEFAULT_MIN_BET;
  }

  private async getMaxBetMinor(): Promise<bigint> {
    const v = await this.settings.get<string>('mines.max_bet_minor').catch(() => null);
    return v ? BigInt(v) : DEFAULT_MAX_BET;
  }

  private async getHouseEdgeBps(): Promise<number> {
    const v = await this.settings.get<number>('mines.house_edge_bps').catch(() => null);
    return typeof v === 'number' && v >= 0 && v < 10_000 ? v : MINES_DEFAULT_HOUSE_EDGE_BPS;
  }

  async toPublicDto(game: MinesGame): Promise<PublicMinesGameDto> {
    const houseEdgeBps = await this.getHouseEdgeBps();
    return toPublicMinesGame(game, houseEdgeBps);
  }
}

function sanitizeClientSeed(input?: string): string | null {
  if (!input) return null;
  const t = input.trim();
  if (t.length === 0 || t.length > 64) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(t)) return null;
  return t;
}

function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002'
  );
}
