import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { minorToJson } from '@chcgreen/shared';
import { PrismaService } from '../../common/prisma/prisma.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

export interface AdminDashboardDto {
  pendingWithdrawalsCount: number;
  pendingWithdrawalsAmountMinor: string;
  openCodePurchasesCount: number;
  openTicketsCount: number;
  usersTotal: number;
  usersActive24h: number;
  // Deposits
  depositsAllTimeCount: number;
  depositsAllTimeAmountMinor: string;
  depositsTodayCount: number;
  depositsTodayAmountMinor: string;
  // FTD — unique users who made at least one completed deposit
  ftdUsersCount: number;
  // Finance
  totalUsersBalanceMinor: string;
  completedWithdrawalsAmountMinor: string;
}

export interface AdminTimeseriesPointDto {
  date: string;
  registrations: number;
  depositsCount: number;
  depositsAmountMinor: string;
  withdrawalsCount: number;
  withdrawalsAmountMinor: string;
  ggrMinor: string;
}

export interface AdminTimeseriesTotalsDto {
  registrations: number;
  depositsCount: number;
  depositsAmountMinor: string;
  withdrawalsCount: number;
  withdrawalsAmountMinor: string;
  ggrMinor: string;
  netMinor: string;
}

export interface AdminTimeseriesDto {
  days: number;
  points: AdminTimeseriesPointDto[];
  totals: AdminTimeseriesTotalsDto;
}

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MODERATOR', 'SUPER_ADMIN')
export class AdminDashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async stats(): Promise<AdminDashboardDto> {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      pendingWithdrawals,
      openCodePurchases,
      openTickets,
      usersTotal,
      usersActive24h,
      depositsAllTime,
      depositsToday,
      ftdResult,
      balanceResult,
      completedWithdrawals,
    ] = await Promise.all([
      this.prisma.withdrawal.findMany({
        where: { status: 'PENDING' },
        select: { amountMinor: true },
      }),
      this.prisma.codePurchase.count({
        where: { status: { in: ['CREATED', 'AWAITING_MODERATOR'] } },
      }),
      this.prisma.ticket.count({
        where: { status: { in: ['OPEN', 'WAITING_MODERATOR', 'WAITING_USER'] } },
      }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { lastLoginAt: { gte: dayAgo } } }),
      // All-time completed deposits
      this.prisma.deposit.findMany({
        where: { status: 'COMPLETED' },
        select: { amountMinor: true },
      }),
      // Today's completed deposits
      this.prisma.deposit.findMany({
        where: { status: 'COMPLETED', completedAt: { gte: todayStart } },
        select: { amountMinor: true },
      }),
      // FTD: distinct users who have a completed deposit
      this.prisma.deposit.groupBy({
        by: ['userId'],
        where: { status: 'COMPLETED' },
        _count: { userId: true },
      }),
      // Sum of all user balances
      this.prisma.user.aggregate({ _sum: { balanceMinor: true } }),
      // Completed withdrawals
      this.prisma.withdrawal.findMany({
        where: { status: 'COMPLETED' },
        select: { amountMinor: true },
      }),
    ]);

    const pendingSum = pendingWithdrawals.reduce<bigint>((acc, w) => acc + w.amountMinor, 0n);
    const depositsAllTimeSum = depositsAllTime.reduce<bigint>((acc, d) => acc + d.amountMinor, 0n);
    const depositsTodaySum = depositsToday.reduce<bigint>((acc, d) => acc + d.amountMinor, 0n);
    const completedWithdrawalsSum = completedWithdrawals.reduce<bigint>((acc, w) => acc + w.amountMinor, 0n);

    return {
      pendingWithdrawalsCount: pendingWithdrawals.length,
      pendingWithdrawalsAmountMinor: minorToJson(pendingSum),
      openCodePurchasesCount: openCodePurchases,
      openTicketsCount: openTickets,
      usersTotal,
      usersActive24h,
      depositsAllTimeCount: depositsAllTime.length,
      depositsAllTimeAmountMinor: minorToJson(depositsAllTimeSum),
      depositsTodayCount: depositsToday.length,
      depositsTodayAmountMinor: minorToJson(depositsTodaySum),
      ftdUsersCount: ftdResult.length,
      totalUsersBalanceMinor: minorToJson(balanceResult._sum.balanceMinor ?? 0n),
      completedWithdrawalsAmountMinor: minorToJson(completedWithdrawalsSum),
    };
  }

  /**
   * Временной ряд по дням за последние N дней (1..90).
   * Регистрации, депозиты, выводы и GGR (рулетка + mines) с разбивкой по дням.
   */
  @Get('timeseries')
  async timeseries(@Query('days') daysRaw?: string): Promise<AdminTimeseriesDto> {
    const days = Math.min(Math.max(Number.parseInt(daysRaw ?? '30', 10) || 30, 1), 90);

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const dayKey = (d: Date): string => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    // Заготовка под каждый день диапазона
    const buckets = new Map<string, AdminTimeseriesPointDto>();
    const order: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = dayKey(d);
      order.push(key);
      buckets.set(key, {
        date: key,
        registrations: 0,
        depositsCount: 0,
        depositsAmountMinor: '0',
        withdrawalsCount: 0,
        withdrawalsAmountMinor: '0',
        ggrMinor: '0',
      });
    }

    const depositsAmount = new Map<string, bigint>();
    const withdrawalsAmount = new Map<string, bigint>();
    const ggrAmount = new Map<string, bigint>();

    const [registrations, deposits, withdrawals, rouletteBets, minesGames] = await Promise.all([
      this.prisma.user.findMany({
        where: { createdAt: { gte: start } },
        select: { createdAt: true },
      }),
      this.prisma.deposit.findMany({
        where: { status: 'COMPLETED', completedAt: { gte: start } },
        select: { completedAt: true, amountMinor: true },
      }),
      this.prisma.withdrawal.findMany({
        where: { status: 'COMPLETED', completedAt: { gte: start } },
        select: { completedAt: true, amountMinor: true },
      }),
      this.prisma.rouletteBet.findMany({
        where: { round: { status: 'COMPLETED', completedAt: { gte: start } } },
        select: { amountMinor: true, payoutMinor: true, round: { select: { completedAt: true } } },
      }),
      this.prisma.minesGame.findMany({
        where: {
          status: { in: ['CASHED_OUT', 'BUSTED'] },
          completedAt: { gte: start },
        },
        select: { completedAt: true, betMinor: true, payoutMinor: true },
      }),
    ]);

    for (const r of registrations) {
      const b = buckets.get(dayKey(r.createdAt));
      if (b) b.registrations += 1;
    }
    for (const d of deposits) {
      if (!d.completedAt) continue;
      const key = dayKey(d.completedAt);
      const b = buckets.get(key);
      if (!b) continue;
      b.depositsCount += 1;
      depositsAmount.set(key, (depositsAmount.get(key) ?? 0n) + d.amountMinor);
    }
    for (const w of withdrawals) {
      if (!w.completedAt) continue;
      const key = dayKey(w.completedAt);
      const b = buckets.get(key);
      if (!b) continue;
      b.withdrawalsCount += 1;
      withdrawalsAmount.set(key, (withdrawalsAmount.get(key) ?? 0n) + w.amountMinor);
    }
    for (const bet of rouletteBets) {
      const completedAt = bet.round?.completedAt;
      if (!completedAt) continue;
      const key = dayKey(completedAt);
      if (!buckets.has(key)) continue;
      const ggr = bet.amountMinor - (bet.payoutMinor ?? 0n);
      ggrAmount.set(key, (ggrAmount.get(key) ?? 0n) + ggr);
    }
    for (const g of minesGames) {
      if (!g.completedAt) continue;
      const key = dayKey(g.completedAt);
      if (!buckets.has(key)) continue;
      const ggr = g.betMinor - g.payoutMinor;
      ggrAmount.set(key, (ggrAmount.get(key) ?? 0n) + ggr);
    }

    let totalReg = 0;
    let totalDepCount = 0;
    let totalWdCount = 0;
    let totalDep = 0n;
    let totalWd = 0n;
    let totalGgr = 0n;

    const points = order.map((key) => {
      const b = buckets.get(key)!;
      const dep = depositsAmount.get(key) ?? 0n;
      const wd = withdrawalsAmount.get(key) ?? 0n;
      const ggr = ggrAmount.get(key) ?? 0n;
      totalReg += b.registrations;
      totalDepCount += b.depositsCount;
      totalWdCount += b.withdrawalsCount;
      totalDep += dep;
      totalWd += wd;
      totalGgr += ggr;
      return {
        ...b,
        depositsAmountMinor: minorToJson(dep),
        withdrawalsAmountMinor: minorToJson(wd),
        ggrMinor: minorToJson(ggr),
      };
    });

    return {
      days,
      points,
      totals: {
        registrations: totalReg,
        depositsCount: totalDepCount,
        depositsAmountMinor: minorToJson(totalDep),
        withdrawalsCount: totalWdCount,
        withdrawalsAmountMinor: minorToJson(totalWd),
        ggrMinor: minorToJson(totalGgr),
        netMinor: minorToJson(totalDep - totalWd),
      },
    };
  }
}
