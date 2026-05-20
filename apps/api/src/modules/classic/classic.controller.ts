import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { ClassicService } from './classic.service';
import { PlaceClassicBetDto } from './classic.dto';
import { toPublicClassicBet, toPublicClassicRound, type PublicClassicRoundDto } from './classic.mapper';
import { SettingsService } from '../settings/settings.service';
import {
  CLASSIC_DEFAULT_MAX_BET,
  CLASSIC_DEFAULT_MIN_BET,
  CLASSIC_DEFAULT_MIN_PLAYERS,
  CLASSIC_DEFAULT_ROLLING_DURATION_MS,
  CLASSIC_DEFAULT_ROUND_DURATION_SEC,
} from './classic.constants';

@Controller('classic')
export class ClassicController {
  constructor(
    private readonly service: ClassicService,
    private readonly settings: SettingsService,
  ) {}

  @Get('state')
  async state(): Promise<{ round: PublicClassicRoundDto | null }> {
    const data = await this.service.getActiveOrLatestRound();
    if (!data) return { round: null };
    return {
      round: toPublicClassicRound(data.round, data.bets, {
        countdownStartedAt: data.countdownStartedAt,
      }),
    };
  }

  @Get('limits')
  async limits() {
    const [minBet, maxBet, roundDur, rollDur, minPlayers] = await Promise.all([
      this.settings.get<string>('classic.min_bet_minor'),
      this.settings.get<string>('classic.max_bet_minor'),
      this.settings.get<number>('classic.round_duration_sec'),
      this.settings.get<number>('classic.rolling_duration_sec'),
      this.settings.get<number>('classic.min_players_to_start'),
    ]);
    return {
      minBetMinor: minBet ?? CLASSIC_DEFAULT_MIN_BET.toString(),
      maxBetMinor: maxBet ?? CLASSIC_DEFAULT_MAX_BET.toString(),
      roundDurationSec: roundDur ?? CLASSIC_DEFAULT_ROUND_DURATION_SEC,
      rollingDurationSec: rollDur ?? CLASSIC_DEFAULT_ROLLING_DURATION_MS / 1000,
      minPlayersToStart: minPlayers ?? CLASSIC_DEFAULT_MIN_PLAYERS,
    };
  }

  @Get('history')
  async history(@Query('limit') limit?: string): Promise<{ items: PublicClassicRoundDto[] }> {
    const items = await this.service.listHistory(Math.min(Number(limit) || 20, 50));
    return {
      items: items.map((r) =>
        toPublicClassicRound(r.round, r.bets, { revealServerSeed: true }),
      ),
    };
  }

  @Get('my-bets')
  @UseGuards(JwtAuthGuard)
  async myBets(@CurrentUser() user: AccessTokenPayload, @Query('limit') limit?: string) {
    const items = await this.service.listMyBets(user.sub, Math.min(Number(limit) || 30, 100));
    return { items: items.map((b) => toPublicClassicBet(b)) };
  }

  @Post('bets')
  @UseGuards(JwtAuthGuard)
  async placeBet(@CurrentUser() user: AccessTokenPayload, @Body() dto: PlaceClassicBetDto) {
    const bet = await this.service.placeBet({
      userId: user.sub,
      amountMinor: BigInt(dto.amountMinor),
    });
    return toPublicClassicBet(bet);
  }
}
