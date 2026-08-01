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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { DepositsService } from './deposits.service';
import { CreateDepositDto } from './deposits.dto';
import { toPublicDeposit, type PublicDepositDto } from './deposits.mapper';

interface DepositsListResponse {
  items: PublicDepositDto[];
  nextCursor: string | null;
}

@Controller('deposits')
@UseGuards(JwtAuthGuard)
export class DepositsController {
  constructor(private readonly deposits: DepositsService) {}

  @Post()
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() body: CreateDepositDto,
  ): Promise<PublicDepositDto> {
    const deposit = await this.deposits.createDeposit({
      userId: user.sub,
      paymentMethodId: body.paymentMethodId,
      amountMinor: BigInt(body.amountMinor),
    });
    return toPublicDeposit(deposit);
  }

  @Get()
  async list(
    @CurrentUser() user: AccessTokenPayload,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('cursor') cursor?: string,
  ): Promise<DepositsListResponse> {
    const { items, nextCursor } = await this.deposits.listForUser({
      userId: user.sub,
      limit,
      cursor,
    });
    return { items: items.map(toPublicDeposit), nextCursor };
  }
}
