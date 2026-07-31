import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import type { CodePurchase } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.module';
import { debitBalance } from '../../common/balance';
import { SettingsService } from '../settings/settings.service';

/**
 * Покупка кода: пользователь оставляет заявку, в чате модератор присылает код
 * и сам списывает баланс через админ-эндпоинт `adminDebit`. На момент создания
 * заявки баланс **не** удерживается — сумму определяет модератор.
 */
@Injectable()
export class CodePurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async create(params: {
    userId: string;
    comment?: string;
  }): Promise<{ purchase: CodePurchase; ticketId: string }> {
    const { userId, comment } = params;
    const enabled = await this.settings.get<boolean>('gameplay.code_purchase_enabled');
    if (!enabled) {
      throw new BadRequestException('CODE_PURCHASE_DISABLED');
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!user) throw new NotFoundException('USER_NOT_FOUND');

      const ticket = await tx.ticket.create({
        data: {
          userId,
          type: 'CODE_PURCHASE',
          status: 'WAITING_MODERATOR',
          subject: 'Покупка кода',
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
                  body: 'Создана заявка на покупку кода. Дождитесь ответа модератора.',
                },
              },
        },
      });

      const purchase = await tx.codePurchase.create({
        data: {
          userId,
          ticketId: ticket.id,
          amountMinor: 0n,
          status: 'AWAITING_MODERATOR',
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
            body: 'Заявка отменена пользователем.',
          },
        });
      }

      return tx.codePurchase.update({
        where: { id: p.id },
        data: { status: 'CANCELLED', completedAt: new Date() },
      });
    });
  }

  /**
   * Списание баланса пользователя модератором при выдаче кода.
   * Гарантирует, что баланс не уйдёт в минус.
   */
  async adminDebit(params: {
    purchaseId: string;
    moderatorId: string;
    amountMinor: bigint;
    code?: string;
  }): Promise<CodePurchase> {
    const { purchaseId, moderatorId, amountMinor, code } = params;
    if (amountMinor <= 0n) throw new BadRequestException('AMOUNT_MUST_BE_POSITIVE');

    return this.prisma.$transaction(async (tx) => {
      const p = await tx.codePurchase.findUnique({ where: { id: purchaseId } });
      if (!p) throw new NotFoundException('CODE_PURCHASE_NOT_FOUND');
      if (p.status === 'COMPLETED' || p.status === 'CANCELLED') {
        throw new ConflictException('CODE_PURCHASE_NOT_DEBITABLE');
      }

      // Списание с проверкой средств внутри UPDATE (защита от гонки с игрой/выводом)
      const balanceAfter = await debitBalance(tx, p.userId, amountMinor);

      await tx.transaction.create({
        data: {
          userId: p.userId,
          type: 'ADMIN_DEBIT',
          status: 'COMPLETED',
          amountMinor: -amountMinor,
          balanceAfterMinor: balanceAfter,
          idempotencyKey: `code:${p.id}:debit`,
          referenceType: 'code_purchase',
          referenceId: p.id,
          description: `Code purchase debit by moderator ${moderatorId}`,
        },
      });

      const purchase = await tx.codePurchase.update({
        where: { id: p.id },
        data: {
          amountMinor,
          status: 'COMPLETED',
          ...(code ? { code, issuedByModeratorId: moderatorId } : {}),
          completedAt: new Date(),
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
            authorId: moderatorId,
            kind: 'SYSTEM',
            body: `Списано ${(Number(amountMinor) / 100).toFixed(2)} AZN. Код выдан.`,
          },
        });
      }

      return purchase;
    });
  }
}
