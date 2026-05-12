import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { RouletteService } from './roulette.service';
import { PlaceBetDto } from './roulette.dto';
import { toPublicBet, toPublicRound, type PublicRoundDto } from './roulette.mapper';

@Controller('roulette')
export class RouletteController {
  constructor(private readonly service: RouletteService) {}

  @Get('state')
  async state(): Promise<{ round: PublicRoundDto | null; recentBets: ReturnType<typeof toPublicBet>[] }> {
    const data = await this.service.getActiveOrLatestRound();
    if (!data) return { round: null, recentBets: [] };
    const recentBets = await this.service.listRecentBets(data.round.id, 50);
    return {
      round: toPublicRound(data.round, data.bets),
      recentBets: recentBets.map((b) => toPublicBet(b)),
    };
  }

  @Get('history')
  async history(@Query('limit') limit?: string): Promise<{ items: PublicRoundDto[] }> {
    const rounds = await this.service.listHistory(Math.min(Number(limit) || 20, 50));
    return { items: rounds.map((r) => toPublicRound(r, [])) };
  }

  @Get('my-bets')
  @UseGuards(JwtAuthGuard)
  async myBets(@CurrentUser() user: AccessTokenPayload, @Query('limit') limit?: string) {
    const items = await this.service.listMyBets(user.sub, Math.min(Number(limit) || 30, 100));
    return { items: items.map((b) => toPublicBet(b)) };
  }

  @Post('bets')
  @UseGuards(JwtAuthGuard)
  async placeBet(@CurrentUser() user: AccessTokenPayload, @Body() dto: PlaceBetDto) {
    const bet = await this.service.placeBet({
      userId: user.sub,
      color: dto.color,
      amountMinor: BigInt(dto.amountMinor),
    });
    return toPublicBet(bet);
  }
}
