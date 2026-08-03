import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { minorToJson } from '@chcgreen/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { LotteryService } from './lottery.service';

export const buyTicketSchema = z.object({
  clientSeed: z.string().max(64).optional(),
});
export class BuyTicketDto extends createZodDto(buyTicketSchema) {}

@Controller('lottery')
export class LotteryController {
  constructor(private readonly lottery: LotteryService) {}

  /** Правила и призовая таблица — видны и гостям. */
  @Get('info')
  async info() {
    const table = await this.lottery.prizeTable();
    return {
      betMinor: minorToJson(table.betMinor),
      prizes: table.items.map((i) => ({
        symbol: i.symbol,
        multiplierBps: i.multiplierBps,
        prizeMinor: minorToJson(i.prizeMinor),
        oddsOneIn: i.oddsOneIn,
      })),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @Post('buy')
  async buy(@CurrentUser() user: AccessTokenPayload, @Body() body: BuyTicketDto) {
    const t = await this.lottery.buyTicket({
      userId: user.sub,
      ...(body.clientSeed ? { clientSeed: body.clientSeed } : {}),
    });
    return {
      id: t.id,
      betMinor: minorToJson(t.betMinor),
      prizeMinor: minorToJson(t.prizeMinor),
      symbols: t.symbols,
      winningSymbol: t.winningSymbol,
      multiplierBps: t.multiplierBps,
      balanceMinor: minorToJson(t.balanceMinor),
      serverSeed: t.serverSeed,
      serverSeedHash: t.serverSeedHash,
      clientSeed: t.clientSeed,
      createdAt: t.createdAt.toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('history')
  async history(
    @CurrentUser() user: AccessTokenPayload,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('cursor') cursor?: string,
  ) {
    const { items, nextCursor } = await this.lottery.history({
      userId: user.sub,
      limit,
      ...(cursor ? { cursor } : {}),
    });
    return {
      items: items.map((t) => ({
        id: t.id,
        betMinor: minorToJson(t.betMinor),
        prizeMinor: minorToJson(t.prizeMinor),
        symbols: t.symbols,
        winningSymbol: t.winningSymbol,
        serverSeed: t.serverSeed,
        serverSeedHash: t.serverSeedHash,
        clientSeed: t.clientSeed,
        createdAt: t.createdAt.toISOString(),
      })),
      nextCursor,
    };
  }
}
