import { Controller, Get, UseGuards } from '@nestjs/common';
import { minorToJson } from '@chcgreen/shared';
import { PrismaService } from '../../common/prisma/prisma.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

export interface AdminRouletteRoundRow {
  id: string;
  status: string;
  winningColor: string | null;
  winningSlot: number | null;
  betsCount: number;
  totalBetsMinor: string;
  totalPayoutsMinor: string;
  ggrMinor: string;
  startedAt: string;
  completedAt: string | null;
}

export interface AdminRouletteStatsDto {
  todayGgrMinor: string;
  todayBetsMinor: string;
  todayGgrPct: number;
  allTimeGgrMinor: string;
  roundsToday: number;
  roundsTotal: number;
  recentRounds: AdminRouletteRoundRow[];
}

@Controller('admin/roulette')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminRouletteController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('stats')
  async stats(): Promise<AdminRouletteStatsDto> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [recentRounds, todayRoundsAgg, allTimeAgg, roundsTotal] = await Promise.all([
      this.prisma.rouletteRound.findMany({
        where: { status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        take: 20,
        include: {
          bets: { select: { amountMinor: true, payoutMinor: true } },
        },
      }),
      this.prisma.rouletteBet.aggregate({
        where: {
          round: { status: 'COMPLETED', completedAt: { gte: todayStart } },
        },
        _sum: { amountMinor: true, payoutMinor: true },
      }),
      this.prisma.rouletteBet.aggregate({
        where: { round: { status: 'COMPLETED' } },
        _sum: { amountMinor: true, payoutMinor: true },
      }),
      this.prisma.rouletteRound.count({ where: { status: 'COMPLETED' } }),
    ]);

    const roundsToday = await this.prisma.rouletteRound.count({
      where: { status: 'COMPLETED', completedAt: { gte: todayStart } },
    });

    const todayBets = todayRoundsAgg._sum.amountMinor ?? 0n;
    const todayPayouts = todayRoundsAgg._sum.payoutMinor ?? 0n;
    const todayGgr = todayBets - todayPayouts;

    const allBets = allTimeAgg._sum.amountMinor ?? 0n;
    const allPayouts = allTimeAgg._sum.payoutMinor ?? 0n;
    const allTimeGgr = allBets - allPayouts;

    const roundRows: AdminRouletteRoundRow[] = recentRounds.map((r) => {
      const totalBets = r.bets.reduce<bigint>((sum, b) => sum + b.amountMinor, 0n);
      const totalPayouts = r.bets.reduce<bigint>((sum, b) => sum + (b.payoutMinor ?? 0n), 0n);
      const ggr = totalBets - totalPayouts;
      return {
        id: r.id,
        status: r.status,
        winningColor: r.winningColor,
        winningSlot: r.winningSlot,
        betsCount: r.bets.length,
        totalBetsMinor: minorToJson(totalBets),
        totalPayoutsMinor: minorToJson(totalPayouts),
        ggrMinor: minorToJson(ggr),
        startedAt: r.startedAt.toISOString(),
        completedAt: r.completedAt?.toISOString() ?? null,
      };
    });

    const todayGgrPct =
      todayBets > 0n ? Math.round(Number((todayGgr * 10000n) / todayBets)) / 100 : 0;

    return {
      todayGgrMinor: minorToJson(todayGgr),
      todayBetsMinor: minorToJson(todayBets),
      todayGgrPct,
      allTimeGgrMinor: minorToJson(allTimeGgr),
      roundsToday,
      roundsTotal,
      recentRounds: roundRows,
    };
  }
}
