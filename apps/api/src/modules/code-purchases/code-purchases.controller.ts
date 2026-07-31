import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { CodePurchasesService } from './code-purchases.service';
import { CreateCodePurchaseDto } from './code-purchases.dto';
import { toPublicCodePurchase, type PublicCodePurchaseDto } from './code-purchases.mapper';

@Controller('code-purchases')
@UseGuards(JwtAuthGuard)
export class CodePurchasesController {
  constructor(private readonly purchases: CodePurchasesService) {}

  @Throttle({ default: { ttl: 600_000, limit: 10 } })
  @Post()
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() body: CreateCodePurchaseDto,
  ): Promise<PublicCodePurchaseDto & { ticketId: string }> {
    const { purchase, ticketId } = await this.purchases.create({
      userId: user.sub,
      ...(body.comment ? { comment: body.comment } : {}),
    });
    return { ...toPublicCodePurchase(purchase), ticketId };
  }

  @Get()
  async list(
    @CurrentUser() user: AccessTokenPayload,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('cursor') cursor?: string,
  ): Promise<{ items: PublicCodePurchaseDto[]; nextCursor: string | null }> {
    const { items, nextCursor } = await this.purchases.listForUser({
      userId: user.sub,
      limit,
      ...(cursor ? { cursor } : {}),
    });
    return { items: items.map(toPublicCodePurchase), nextCursor };
  }

  @Post(':id/cancel')
  async cancel(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<PublicCodePurchaseDto> {
    const p = await this.purchases.cancelByUser({ userId: user.sub, purchaseId: id });
    return toPublicCodePurchase(p);
  }
}
