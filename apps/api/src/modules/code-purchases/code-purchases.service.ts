import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import type { CodePurchase } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.module';

const DEFAULT_MIN_MINOR = 100n;
const DEFAULT_MAX_MINOR = 1_000_000n;

/**
 * Покупка кода: пользователь резервирует средства, в чате модератор присылает код.
 * На MVP: создание → hold → отмена → возврат. Сам факт выдачи/списания добавится
 * через админ-эндпоинт в следующей итерации.
 */
@Injectable()
export class CodePurchasesService {
  private readonly minMinor: bigint;
  private readonly maxMinor: bigint;

  constructor(private readonly prisma: PrismaService) {
    this.minMinor = BigInt(process.env.CODE_PURCHASE_MIN_MINOR || DEFAULT_MIN_MINOR.toString());
    this.maxMinor = BigInt(process.env.CODE_PURCHASE_MAX_MINOR || DEFAULT_MAX_MINOR.toString());
  }

  async create(params: {
    userId: string;
    amountMinor: bigint;
    comment?: string;
  }): Promise<{ purchase: CodePurchase; ticketId: string }> {
    const { userId, amountMinor, comment } = params;
    if (amountMinor < this.minMinor || amountMinor > this.maxMinor) {
      throw new BadRequestException(
        `Amount must be between ${this.minMinor} and ${this.maxMinor} qəpik`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { balanceMinor: true },
      });
      if (!user) throw new NotFoundException('USER_NOT_FOUND');
      if (user.balanceMinor < amountMinor) throw new ConflictException('INSUFFICIENT_FUNDS');

      const ticket = await tx.ticket.create({
        data: {
          userId,
          type: 'CODE_PURCHASE',
          status: 'WAITING_MODERATOR',
          subject: `Покупка кода ${amountMinor.toString()}`,
          messages: comment
            ? {
                create: {
                  authorId: userId,
                  kind: 'TEXT',
                  body: comment,
                },
              }
            : {
                create: {
                  authorId: null,
                  kind: 'SYSTEM',
                  body: `Создана заявка на покупку кода на сумму ${(Number(amountMinor) / 100).toFixed(2)} AZN`,
                },
              },
        },
      });

      const purchase = await tx.codePurchase.create({
        data: {
          userId,
          ticketId: ticket.id,
          amountMinor,
          status: 'AWAITING_MODERATOR',
        },
      });

      const updated = await tx.user.update({
        where: { id: userId },
        data: { balanceMinor: { decrement: amountMinor } },
        select: { balanceMinor: true },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'CODE_HOLD',
          status: 'PENDING',
          amountMinor: -amountMinor,
          balanceAfterMinor: updated.balanceMinor,
          idempotencyKey: `code:${purchase.id}:hold`,
          referenceType: 'code_purchase',
          referenceId: purchase.id,
          description: 'Code purchase hold',
        },
      });

      return { purchase, ticketId: ticket.id };
    });
  }

  async listForUser(params: {
    userId: string;
    limit: number;
    cursor?: string;
  }): Promise<{ items: CodePurchase[]; nextCursor: string | null }> {
    const take = Math.min(Math.max(params.limit, 1), 100);
    const items = await this.prisma.codePurchase.findMany({
      where: { userId: params.userId },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });
    let nextCursor: string | null = null;
    if (items.length > take) {
      const next = items.pop();
      nextCursor = next?.id ?? null;
    }
    return { items, nextCursor };
  }

  async cancelByUser(params: { userId: string; purchaseId: string }): Promise<CodePurchase> {
    const { userId, purchaseId } = params;
    return this.prisma.$transaction(async (tx) => {
      const p = await tx.codePurchase.findUnique({ where: { id: purchaseId } });
      if (!p) throw new NotFoundException('CODE_PURCHASE_NOT_FOUND');
      if (p.userId !== userId) throw new ForbiddenException('CODE_PURCHASE_FORBIDDEN');
      if (p.status === 'CANCELLED') return p;
      if (p.status === 'COMPLETED' || p.status === 'CODE_ISSUED') {
        throw new ConflictException('CODE_PURCHASE_NOT_CANCELLABLE');
      }

      const refundKey = `code:${p.id}:release`;
      const existing = await tx.transaction.findUnique({ where: { idempotencyKey: refundKey } });
      if (existing) {
        return tx.codePurchase.update({
          where: { id: p.id },
          data: { status: 'CANCELLED', completedAt: new Date() },
        });
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: { balanceMinor: { increment: p.amountMinor } },
        select: { balanceMinor: true },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'CODE_RELEASE',
          status: 'COMPLETED',
          amountMinor: p.amountMinor,
          balanceAfterMinor: updated.balanceMinor,
          idempotencyKey: refundKey,
          referenceType: 'code_purchase',
          referenceId: p.id,
          description: 'Code purchase cancelled — refund',
        },
      });

      if (p.ticketId) {
        await tx.ticket.update({
          where: { id: p.ticketId },
          data: { status: 'CLOSED', closedAt: new Date() },
        });
        await tx.message.create({
          data: {
            ticketId: p.ticketId,
            authorId: null,
            kind: 'SYSTEM',
            body: 'Заявка отменена пользователем, средства возвращены.',
          },
        });
      }

      return tx.codePurchase.update({
        where: { id: p.id },
        data: { status: 'CANCELLED', completedAt: new Date() },
      });
    });
  }
}
