import { Controller, Get, UseGuards } from '@nestjs/common';
import { minorToJson } from '@chcgreen/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { RanksService } from './ranks.service';
import { toPublicRank, type PublicRankDto, type MyRankProgressDto } from './ranks.mapper';

@Controller('ranks')
export class RanksController {
  constructor(private readonly ranks: RanksService) {}

  @Get()
  async list(): Promise<{ items: PublicRankDto[] }> {
    const items = await this.ranks.listAll();
    return { items: items.map(toPublicRank) };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AccessTokenPayload): Promise<MyRankProgressDto> {
    const p = await this.ranks.getProgress(user.sub);
    return {
      totalWageredMinor: minorToJson(p.totalWageredMinor),
      current: p.current ? toPublicRank(p.current) : null,
      next: p.next ? toPublicRank(p.next) : null,
      progressBps: p.progressBps,
    };
  }
}
