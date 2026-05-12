import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, Transaction, TransactionType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.module';

export interface WalletBalance {
  balanceMinor: bigint;
  totalWageredMinor: bigint;
}

export interface ListTransactionsParams {
  userId: string;
  limit: number;
  cursor?: string | undefined;
  type?: TransactionType | undefined;
}

export interface ListTransactionsResult {
  items: Transaction[];
  nextCursor: string | null;
}

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalance(userId: string): Promise<WalletBalance> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { balanceMinor: true, totalWageredMinor: true },
    });
    if (!user) throw new NotFoundException('USER_NOT_FOUND');
    return user;
  }

  async listTransactions(params: ListTransactionsParams): Promise<ListTransactionsResult> {
    const { userId, limit, cursor, type } = params;
    const take = Math.min(Math.max(limit, 1), 100);

    const where: Prisma.TransactionWhereInput = { userId };
    if (type) where.type = type;

    const items = await this.prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    let nextCursor: string | null = null;
    if (items.length > take) {
      const next = items.pop();
      nextCursor = next?.id ?? null;
    }
    return { items, nextCursor };
  }
}
