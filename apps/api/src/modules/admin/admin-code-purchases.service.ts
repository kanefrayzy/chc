import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.module';
import { AdminAuditService } from './admin-audit.service';

@Injectable()
export class AdminCodePurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  async list(params: { status?: string; limit: number; cursor?: string }) {
    const take = Math.min(Math.max(params.limit, 1), 100);
    const where = params.status ? { status: params.status as never } : {};
    const items = await this.prisma.codePurchase.findMany({
      where,
      include: { user: { select: { username: true } } },
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

  async issue(params: {
    actorId: string;
    purchaseId: string;
    code: string;
    ip?: string;
    userAgent?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const p = await tx.codePurchase.findUnique({ where: { id: params.purchaseId } });
      if (!p) throw new NotFoundException('CODE_PURCHASE_NOT_FOUND');
      if (p.status === 'CANCELLED' || p.status === 'COMPLETED' || p.status === 'CODE_ISSUED') {
        throw new ConflictException('CODE_PURCHASE_NOT_ISSUABLE');
      }

      // Финализируем hold: статус → COMPLETED. Деньги уже списаны при create.
      const holdKey = `code:${p.id}:hold`;
      const hold = await tx.transaction.findUnique({ where: { idempotencyKey: holdKey } });
      if (hold && hold.status === 'PENDING') {
        await tx.transaction.update({
          where: { id: hold.id },
          data: { status: 'COMPLETED' },
        });
      }

      const updated = await tx.codePurchase.update({
        where: { id: p.id },
        data: {
          status: 'COMPLETED',
          code: params.code,
          issuedByModeratorId: params.actorId,
          completedAt: new Date(),
        },
        include: { user: { select: { username: true } } },
      });

      if (p.ticketId) {
        await tx.message.create({
          data: {
            ticketId: p.ticketId,
            authorId: params.actorId,
            kind: 'ACTION',
            body: `Код выдан: ${params.code}`,
          },
        });
        await tx.ticket.update({
          where: { id: p.ticketId },
          data: { status: 'CLOSED', closedAt: new Date(), moderatorId: params.actorId },
        });
      }

      await this.audit.log({
        actorId: params.actorId,
        action: 'code_purchase.issue',
        entityType: 'code_purchase',
        entityId: p.id,
        payload: { amountMinor: p.amountMinor.toString() },
        ip: params.ip,
        userAgent: params.userAgent,
        tx,
      });

      return updated;
    });
  }

  async reject(params: {
    actorId: string;
    purchaseId: string;
    reason: string;
    ip?: string;
    userAgent?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const p = await tx.codePurchase.findUnique({ where: { id: params.purchaseId } });
      if (!p) throw new NotFoundException('CODE_PURCHASE_NOT_FOUND');
      if (p.status === 'CANCELLED') return p;
      if (p.status === 'COMPLETED' || p.status === 'CODE_ISSUED') {
        throw new ConflictException('CODE_PURCHASE_NOT_REJECTABLE');
      }

      const refundKey = `code:${p.id}:release`;
      const existing = await tx.transaction.findUnique({ where: { idempotencyKey: refundKey } });
      if (!existing) {
        const updatedUser = await tx.user.update({
          where: { id: p.userId },
          data: { balanceMinor: { increment: p.amountMinor } },
          select: { balanceMinor: true },
        });
        await tx.transaction.create({
          data: {
            userId: p.userId,
            type: 'CODE_RELEASE',
            status: 'COMPLETED',
            amountMinor: p.amountMinor,
            balanceAfterMinor: updatedUser.balanceMinor,
            idempotencyKey: refundKey,
            referenceType: 'code_purchase',
            referenceId: p.id,
            description: `Code purchase rejected: ${params.reason.slice(0, 100)}`,
          },
        });
      }

      if (p.ticketId) {
        await tx.message.create({
          data: {
            ticketId: p.ticketId,
            authorId: params.actorId,
            kind: 'ACTION',
            body: `Заявка отклонена: ${params.reason}`,
          },
        });
        await tx.ticket.update({
          where: { id: p.ticketId },
          data: { status: 'CLOSED', closedAt: new Date(), moderatorId: params.actorId },
        });
      }

      const updated = await tx.codePurchase.update({
        where: { id: p.id },
        data: { status: 'CANCELLED', completedAt: new Date() },
        include: { user: { select: { username: true } } },
      });

      await this.audit.log({
        actorId: params.actorId,
        action: 'code_purchase.reject',
        entityType: 'code_purchase',
        entityId: p.id,
        payload: { reason: params.reason },
        ip: params.ip,
        userAgent: params.userAgent,
        tx,
      });

      return updated;
    });
  }
}
