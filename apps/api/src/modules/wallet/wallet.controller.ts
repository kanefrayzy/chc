import {
  Controller,
  Get,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { TransactionType } from '@prisma/client';
import { minorToJson } from '@chcgreen/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { WalletService } from './wallet.service';
import { toPublicTransaction, type PublicTransactionDto } from './wallet.mapper';

interface BalanceResponse {
  balanceMinor: string;
  totalWageredMinor: string;
}

interface TransactionsResponse {
  items: PublicTransactionDto[];
  nextCursor: string | null;
}

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get('balance')
  async getBalance(@CurrentUser() user: AccessTokenPayload): Promise<BalanceResponse> {
    const { balanceMinor, totalWageredMinor } = await this.wallet.getBalance(user.sub);
    return {
      balanceMinor: minorToJson(balanceMinor),
      totalWageredMinor: minorToJson(totalWageredMinor),
    };
  }

  @Get('transactions')
  async getTransactions(
    @CurrentUser() user: AccessTokenPayload,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('cursor') cursor?: string,
    @Query('type') type?: TransactionType,
  ): Promise<TransactionsResponse> {
    const { items, nextCursor } = await this.wallet.listTransactions({
      userId: user.sub,
      limit,
      cursor,
      type,
    });
    return { items: items.map(toPublicTransaction), nextCursor };
  }
}
