import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { MinesService } from './mines.service';
import { RevealMinesDto, StartMinesDto } from './mines.dto';
import type { PublicMinesGameDto } from './mines.mapper';

@Controller('mines')
export class MinesController {
  constructor(private readonly service: MinesService) {}

  @Get('limits')
  async limits() {
    return this.service.getPublicLimits();
  }

  @Get('state')
  @UseGuards(JwtAuthGuard)
  async state(@CurrentUser() user: AccessTokenPayload): Promise<{ game: PublicMinesGameDto | null }> {
    const game = await this.service.getActiveOrLatest(user.sub);
    if (!game) return { game: null };
    return { game: await this.service.toPublicDto(game) };
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  async history(
    @CurrentUser() user: AccessTokenPayload,
    @Query('limit') limit?: string,
  ): Promise<{ items: PublicMinesGameDto[] }> {
    const items = await this.service.listHistory(user.sub, Math.min(Number(limit) || 30, 100));
    return { items: await Promise.all(items.map((g) => this.service.toPublicDto(g))) };
  }

  @Post('start')
  @UseGuards(JwtAuthGuard)
  async start(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: StartMinesDto,
  ): Promise<PublicMinesGameDto> {
    return this.service.start({
      userId: user.sub,
      amountMinor: BigInt(dto.amountMinor),
      mineCount: dto.mineCount,
      clientSeed: dto.clientSeed,
    });
  }

  @Post('reveal')
  @UseGuards(JwtAuthGuard)
  async reveal(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: RevealMinesDto,
  ): Promise<PublicMinesGameDto> {
    return this.service.reveal({ userId: user.sub, tile: dto.tile });
  }

  @Post('cashout')
  @UseGuards(JwtAuthGuard)
  async cashout(@CurrentUser() user: AccessTokenPayload): Promise<PublicMinesGameDto> {
    return this.service.cashout({ userId: user.sub });
  }
}
