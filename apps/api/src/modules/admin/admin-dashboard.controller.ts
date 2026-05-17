import { Controller, Get, UseGuards } from '@nestjs/common';
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
}
