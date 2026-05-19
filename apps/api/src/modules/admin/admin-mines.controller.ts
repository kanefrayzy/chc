import { Controller, Get, UseGuards } from '@nestjs/common';
import { minorToJson } from '@chcgreen/shared';
import { PrismaService } from '../../common/prisma/prisma.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

export interface AdminMinesGameRow {
  id: string;
  username: string;
  status: string;
  mineCount: number;
  revealedCount: number;
  betMinor: string;
  payoutMinor: string;
  ggrMinor: string;
  multiplierBps: number;
  startedAt: string;
  completedAt: string | null;
}

export interface AdminMinesByMineCountRow {
  mineCount: number;
  games: number;
  wageredMinor: string;
  paidOutMinor: string;
  ggrMinor: string;
  rtpPct: number;
}

export interface AdminMinesStatsDto {
  todayGgrMinor: string;
  todayWageredMinor: string;
  todayPaidOutMinor: string;
  todayGgrPct: number;
  allTimeGgrMinor: string;
  allTimeWageredMinor: string;
  allTimePaidOutMinor: string;
  allTimeRtpPct: number;
  gamesToday: number;
  gamesTotal: number;
  activeGames: number;
  cashedOutTotal: number;
  bustedTotal: number;
  bustedPct: number;
  byMineCount: AdminMinesByMineCountRow[];
  recentGames: AdminMinesGameRow[];
}

@Controller('admin/mines')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminMinesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('stats')
  async stats(): Promise<AdminMinesStatsDto> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const finishedFilter = { status: { in: ['CASHED_OUT', 'BUSTED'] as ('CASHED_OUT' | 'BUSTED')[] } };

    const [
      todayAgg,
      allTimeAgg,
      gamesToday,
      gamesTotal,
      activeGames,
      cashedOutTotal,
      bustedTotal,
      byMineCountRaw,
      recent,
    ] = await Promise.all([
      this.prisma.minesGame.aggregate({
        where: { ...finishedFilter, completedAt: { gte: todayStart } },
        _sum: { betMinor: true, payoutMinor: true },
      }),
      this.prisma.minesGame.aggregate({
        where: finishedFilter,
        _sum: { betMinor: true, payoutMinor: true },
      }),
      this.prisma.minesGame.count({
        where: { ...finishedFilter, completedAt: { gte: todayStart } },
      }),
      this.prisma.minesGame.count({ where: finishedFilter }),
      this.prisma.minesGame.count({ where: { status: 'ACTIVE' } }),
      this.prisma.minesGame.count({ where: { status: 'CASHED_OUT' } }),
      this.prisma.minesGame.count({ where: { status: 'BUSTED' } }),
      this.prisma.minesGame.groupBy({
        by: ['mineCount'],
        where: finishedFilter,
        _count: true,
        _sum: { betMinor: true, payoutMinor: true },
        orderBy: { mineCount: 'asc' },
      }),
      this.prisma.minesGame.findMany({
        where: finishedFilter,
        orderBy: { completedAt: 'desc' },
        take: 20,
        include: { user: { select: { username: true } } },
      }),
    ]);

    const todayBets = todayAgg._sum?.betMinor ?? 0n;
    const todayPayouts = todayAgg._sum?.payoutMinor ?? 0n;
    const todayGgr = todayBets - todayPayouts;

    const allBets = allTimeAgg._sum?.betMinor ?? 0n;
    const allPayouts = allTimeAgg._sum?.payoutMinor ?? 0n;
    const allTimeGgr = allBets - allPayouts;

    const todayGgrPct =
      todayBets > 0n ? Math.round(Number((todayGgr * 10000n) / todayBets)) / 100 : 0;
    const allTimeRtpPct =
      allBets > 0n ? Math.round(Number((allPayouts * 10000n) / allBets)) / 100 : 0;

    const byMineCount: AdminMinesByMineCountRow[] = byMineCountRaw.map((r) => {
      const wagered = r._sum?.betMinor ?? 0n;
      const paid = r._sum?.payoutMinor ?? 0n;
      const ggr = wagered - paid;
      const rtpPct =
        wagered > 0n ? Math.round(Number((paid * 10000n) / wagered)) / 100 : 0;
      return {
        mineCount: r.mineCount,
        games: typeof r._count === 'number' ? r._count : 0,
        wageredMinor: minorToJson(wagered),
        paidOutMinor: minorToJson(paid),
        ggrMinor: minorToJson(ggr),
        rtpPct,
      };
    });

    const recentGames: AdminMinesGameRow[] = recent.map((g) => {
      const game = g as typeof g & { user?: { username: string } | null };
      const ggr = game.betMinor - game.payoutMinor;
      return {
        id: game.id,
        username: game.user?.username ?? '—',
        status: game.status,
        mineCount: game.mineCount,
        revealedCount: game.revealedTiles.length,
        betMinor: minorToJson(game.betMinor),
        payoutMinor: minorToJson(game.payoutMinor),
        ggrMinor: minorToJson(ggr),
        multiplierBps: game.multiplierBps,
        startedAt: game.startedAt.toISOString(),
        completedAt: game.completedAt?.toISOString() ?? null,
      };
    });

    const finishedTotal = cashedOutTotal + bustedTotal;
    const bustedPct =
      finishedTotal > 0 ? Math.round((bustedTotal / finishedTotal) * 10000) / 100 : 0;

    return {
      todayGgrMinor: minorToJson(todayGgr),
      todayWageredMinor: minorToJson(todayBets),
      todayPaidOutMinor: minorToJson(todayPayouts),
      todayGgrPct,
      allTimeGgrMinor: minorToJson(allTimeGgr),
      allTimeWageredMinor: minorToJson(allBets),
      allTimePaidOutMinor: minorToJson(allPayouts),
      allTimeRtpPct,
      gamesToday,
      gamesTotal,
      activeGames,
      cashedOutTotal,
      bustedTotal,
      bustedPct,
      byMineCount,
      recentGames,
    };
  }
}
