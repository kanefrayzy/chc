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
}

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MODERATOR', 'SUPER_ADMIN')
export class AdminDashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async stats(): Promise<AdminDashboardDto> {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [pendingWithdrawals, openCodePurchases, openTickets, usersTotal, usersActive24h] =
      await Promise.all([
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
      ]);

    const sum = pendingWithdrawals.reduce<bigint>((acc, w) => acc + w.amountMinor, 0n);
    return {
      pendingWithdrawalsCount: pendingWithdrawals.length,
      pendingWithdrawalsAmountMinor: minorToJson(sum),
      openCodePurchasesCount: openCodePurchases,
      openTicketsCount: openTickets,
      usersTotal,
      usersActive24h,
    };
  }
}
