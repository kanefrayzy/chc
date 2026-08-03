import { Controller, Get, Query } from '@nestjs/common';
import { minorToJson } from '@chcgreen/shared';
import { ProgressiveService } from './progressive.service';

export interface ProgressiveJackpotDto {
  tier: string;
  currentMinor: string;
  enabled: boolean;
}

export interface ProgressiveWinDto {
  tier: string;
  username: string;
  amountMinor: string;
  createdAt: string;
}

@Controller('progressive')
export class ProgressiveController {
  constructor(private readonly service: ProgressiveService) {}

  /** Витрина копилок — доступна гостям. */
  @Get()
  async list(): Promise<{ items: ProgressiveJackpotDto[] }> {
    const items = await this.service.list();
    return {
      items: items
        .filter((i) => i.enabled)
        .map((i) => ({
          tier: i.tier,
          currentMinor: minorToJson(i.currentMinor),
          enabled: i.enabled,
        })),
    };
  }

  @Get('wins')
  async wins(@Query('limit') limit?: string): Promise<{ items: ProgressiveWinDto[] }> {
    const rows = await this.service.recentWins(Number(limit) || 5);
    return {
      items: rows.map((w) => ({
        tier: w.tier,
        username: w.user?.username ?? 'player',
        amountMinor: minorToJson(w.amountMinor),
        createdAt: w.createdAt.toISOString(),
      })),
    };
  }
}
