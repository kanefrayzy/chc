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
import type { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { WithdrawalsService } from './withdrawals.service';
import { CreateWithdrawalDto } from './withdrawals.dto';
import { toPublicWithdrawal, type PublicWithdrawalDto } from './withdrawals.mapper';

interface WithdrawalsListResponse {
  items: PublicWithdrawalDto[];
  nextCursor: string | null;
}

@Controller('withdrawals')
@UseGuards(JwtAuthGuard)
export class WithdrawalsController {
  constructor(private readonly withdrawals: WithdrawalsService) {}

  @Post()
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() body: CreateWithdrawalDto,
  ): Promise<PublicWithdrawalDto> {
    const w = await this.withdrawals.createWithdrawal({
      userId: user.sub,
      paymentMethodId: body.paymentMethodId,
      amountMinor: BigInt(body.amountMinor),
      destination: body.destination as unknown as Prisma.InputJsonValue,
    });
    return toPublicWithdrawal(w);
  }

  @Get()
  async list(
    @CurrentUser() user: AccessTokenPayload,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('cursor') cursor?: string,
  ): Promise<WithdrawalsListResponse> {
    const { items, nextCursor } = await this.withdrawals.listForUser({
      userId: user.sub,
      limit,
      cursor,
    });
    return { items: items.map(toPublicWithdrawal), nextCursor };
  }

  @Post(':id/cancel')
  async cancel(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<PublicWithdrawalDto> {
    const w = await this.withdrawals.cancelByUser({ userId: user.sub, withdrawalId: id });
    return toPublicWithdrawal(w);
  }
}
