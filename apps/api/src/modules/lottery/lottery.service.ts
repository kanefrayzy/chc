import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.module';
import { debitBalance } from '../../common/balance';
import { SettingsService } from '../settings/settings.service';
import { RanksService } from '../ranks/ranks.service';
import { ReferralsService } from '../referrals/referrals.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ProgressiveService } from '../progressive/progressive.service';
import {
  LOTTERY_DEFAULT_BET_MINOR,
  LOTTERY_PRIZES,
  prizeForLevel,
} from './lottery.constants';
import {
  drawLotteryTicket,
  generateLotteryClientSeed,
  generateLotteryServerSeed,
  hashLotteryServerSeed,
} from './lottery.rng';

/** Выигрыш от этой суммы попадает в лог отдельной строкой — чтобы не пропустить. */
const BIG_WIN_ALERT_MINOR = 100_000n; // 1000 AZN

export interface LotteryTicketResult {
  id: string;
  betMinor: bigint;
  prizeMinor: bigint;
  symbols: number[];
  winningSymbol: number | null;
  multiplierBps: number | null;
  balanceMinor: bigint;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  createdAt: Date;
}

@Injectable()
export class LotteryService {
  private readonly logger = new Logger(LotteryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly ranks: RanksService,
    private readonly referrals: ReferralsService,
    private readonly realtime: RealtimeGateway,
    private readonly progressive: ProgressiveService,
  ) {}

  async getBetMinor(): Promise<bigint> {
    try {
      const raw = await this.settings.get<string>('lottery.bet_minor');
      const value = BigInt(raw);
      return value > 0n ? value : LOTTERY_DEFAULT_BET_MINOR;
    } catch {
      return LOTTERY_DEFAULT_BET_MINOR;
    }
  }

  private async isEnabled(): Promise<boolean> {
    try {
      return (await this.settings.get<boolean>('gameplay.lottery_enabled')) !== false;
    } catch {
      return true;
    }
  }

  /** Призовая таблица для витрины — суммы уже пересчитаны под текущую ставку. */
  async prizeTable(): Promise<{
    betMinor: bigint;
    items: { symbol: number; multiplierBps: number; prizeMinor: bigint; oddsOneIn: number }[];
  }> {
    const betMinor = await this.getBetMinor();
    return {
      betMinor,
      items: LOTTERY_PRIZES.map((p) => ({
        symbol: p.symbol,
        multiplierBps: p.multiplierBps,
        prizeMinor: prizeForLevel(betMinor, p),
        oddsOneIn: Math.round(10_000_000 / p.weight),
      })),
    };
  }

  /**
   * Покупка билета: списываем ставку, разыгрываем карту, зачисляем приз.
   * Всё в одной транзакции — карта не может «потеряться» между списанием и выплатой.
   */
  async buyTicket(params: { userId: string; clientSeed?: string }): Promise<LotteryTicketResult> {
    if (!(await this.isEnabled())) throw new BadRequestException('LOTTERY_DISABLED');

    const betMinor = await this.getBetMinor();
    const serverSeed = generateLotteryServerSeed();
    const serverSeedHash = hashLotteryServerSeed(serverSeed);
    const clientSeed = sanitizeClientSeed(params.clientSeed) ?? generateLotteryClientSeed();

    const draw = drawLotteryTicket(serverSeed, clientSeed, 0);
    const prizeMinor = draw.level ? prizeForLevel(betMinor, draw.level) : 0n;

    const result = await this.prisma.$transaction(async (tx) => {
      // Списание с проверкой средств внутри UPDATE (ADR-0009)
      let balance = await debitBalance(tx, params.userId, betMinor, { wager: true });

      const ticket = await tx.lotteryTicket.create({
        data: {
          userId: params.userId,
          betMinor,
          prizeMinor,
          symbols: draw.symbols,
          winningSymbol: draw.level ? draw.level.symbol : null,
          serverSeed,
          serverSeedHash,
          clientSeed,
          nonce: 0,
        },
      });

      await tx.transaction.create({
        data: {
          userId: params.userId,
          type: 'BET_PLACE',
          status: 'COMPLETED',
          amountMinor: -betMinor,
          balanceAfterMinor: balance,
          idempotencyKey: `lottery:${ticket.id}:place`,
          referenceType: 'lottery_ticket',
          referenceId: ticket.id,
          description: 'Лотерейный билет',
        },
      });

      if (prizeMinor > 0n) {
        const updated = await tx.user.update({
          where: { id: params.userId },
          data: { balanceMinor: { increment: prizeMinor } },
          select: { balanceMinor: true },
        });
        balance = updated.balanceMinor;

        await tx.transaction.create({
          data: {
            userId: params.userId,
            type: 'BET_WIN',
            status: 'COMPLETED',
            amountMinor: prizeMinor,
            balanceAfterMinor: balance,
            idempotencyKey: `lottery:${ticket.id}:win`,
            referenceType: 'lottery_ticket',
            referenceId: ticket.id,
            description: 'Выигрыш в лотерее',
          },
        });
      }

      await this.ranks.syncUserRank(params.userId, tx);

      // Реферальный бонус считается от маржи казино по этой игре (ADR-0008)
      await this.referrals.settleGameMargin({
        referredId: params.userId,
        marginMinor: betMinor - prizeMinor,
        referenceType: 'lottery_ticket',
        referenceId: ticket.id,
        tx,
      });

      return { ticket, balance };
    });

    void this.progressive.contribute(betMinor);

    if (prizeMinor >= BIG_WIN_ALERT_MINOR) {
      this.logger.warn(
        `Крупный выигрыш в лотерее: ${prizeMinor} qəpik, билет ${result.ticket.id}, игрок ${params.userId}`,
      );
    }

    this.realtime.emitToUser(params.userId, 'wallet:balance', {
      balanceMinor: result.balance.toString(),
    });

    return {
      id: result.ticket.id,
      betMinor,
      prizeMinor,
      symbols: draw.symbols,
      winningSymbol: draw.level ? draw.level.symbol : null,
      multiplierBps: draw.level ? draw.level.multiplierBps : null,
      balanceMinor: result.balance,
      serverSeed,
      serverSeedHash,
      clientSeed,
      createdAt: result.ticket.createdAt,
    };
  }

  async history(params: { userId: string; limit: number; cursor?: string }) {
    const take = Math.min(Math.max(params.limit, 1), 50);
    const items = await this.prisma.lotteryTicket.findMany({
      where: { userId: params.userId },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(params.cursor ? { skip: 1, cursor: { id: params.cursor } } : {}),
    });
    let nextCursor: string | null = null;
    if (items.length > take) {
      const next = items.pop();
      nextCursor = next?.id ?? null;
    }
    return { items, nextCursor };
  }

  /** Последние выигрышные билеты — для общей ленты. */
  async recentWins(limit = 10) {
    return this.prisma.lotteryTicket.findMany({
      where: { prizeMinor: { gt: 0n } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 50),
      include: { user: { select: { username: true, avatarUrl: true } } },
    });
  }
}

/** Клиентский сид: только безопасные символы, иначе генерируем свой. */
function sanitizeClientSeed(seed: string | undefined): string | null {
  if (!seed) return null;
  const cleaned = seed.trim().slice(0, 64);
  return /^[a-zA-Z0-9_-]{4,64}$/.test(cleaned) ? cleaned : null;
}
