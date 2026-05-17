import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.module';
import { AdminAuditService } from './admin-audit.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class AdminTicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async list(params: { status?: string; type?: string; limit: number; cursor?: string }) {
    const take = Math.min(Math.max(params.limit, 1), 100);
    const where: Record<string, unknown> = {};
    if (params.status) where.status = params.status;
    if (params.type) where.type = params.type;
    const items = await this.prisma.ticket.findMany({
      where: where as never,
      include: {
        user: { select: { username: true } },
        moderator: { select: { username: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
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

  async get(id: string) {
    const t = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        user: { select: { username: true, balanceMinor: true } },
        moderator: { select: { username: true } },
      },
    });
    if (!t) throw new NotFoundException('TICKET_NOT_FOUND');
    return t;
  }

  async listMessages(ticketId: string, params?: { beforeId?: string; afterId?: string; limit?: number }) {
    const take = Math.min(Math.max(params?.limit ?? 30, 1), 100);
    if (params?.beforeId) {
      const msgs = await this.prisma.message.findMany({
        where: { ticketId },
        include: { author: { select: { username: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        take,
        cursor: { id: params.beforeId },
        skip: 1,
      });
      return msgs.reverse();
    }
    return this.prisma.message.findMany({
      where: { ticketId },
      include: { author: { select: { username: true, role: true } } },
      orderBy: { createdAt: 'asc' },
      take,
      ...(params?.afterId ? { cursor: { id: params.afterId }, skip: 1 } : {}),
    });
  }

  async postMessage(params: {
    actorId: string;
    ticketId: string;
    body: string;
    kind?: 'TEXT' | 'FILE';
    ip?: string;
    userAgent?: string;
  }) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: params.ticketId } });
    if (!ticket) throw new NotFoundException('TICKET_NOT_FOUND');
    if (ticket.status === 'CLOSED') throw new BadRequestException('TICKET_CLOSED');

    const [, message] = await this.prisma.$transaction([
      this.prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: 'WAITING_USER',
          moderatorId: ticket.moderatorId ?? params.actorId,
        },
      }),
      this.prisma.message.create({
        data: {
          ticketId: ticket.id,
          authorId: params.actorId,
          kind: params.kind ?? 'TEXT',
          body: params.body,
        },
        include: { author: { select: { username: true, role: true } } },
      }),
    ]);

    await this.audit.log({
      actorId: params.actorId,
      action: 'ticket.message',
      entityType: 'ticket',
      entityId: ticket.id,
      payload: { messageId: message.id },
      ip: params.ip,
      userAgent: params.userAgent,
    });

    try {
      this.realtime.emitToTicket(ticket.id, 'ticket:message', {
        id: message.id,
        ticketId: message.ticketId,
        authorId: message.authorId,
        authorUsername: message.author?.username ?? null,
        authorRole: message.author?.role ?? null,
        kind: message.kind,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
      });
    } catch {
      // не блокируем
    }

    return message;
  }

  /**
   * Начислить или списать баланс пользователя прямо из тикета.
   * amountMinor > 0 → начисление, amountMinor < 0 → списание.
   */
  async adjustBalance(params: {
    actorId: string;
    ticketId: string;
    amountMinor: bigint;
    reason: string;
    ip?: string;
    userAgent?: string;
  }) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: params.ticketId } });
    if (!ticket) throw new NotFoundException('TICKET_NOT_FOUND');

    const type = params.amountMinor >= 0n ? 'ADMIN_CREDIT' : 'ADMIN_DEBIT';
    const absAmount = params.amountMinor < 0n ? -params.amountMinor : params.amountMinor;
    const actor = await this.prisma.user.findUnique({
      where: { id: params.actorId },
      select: { username: true },
    });

    const [updatedUser] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: ticket.userId },
        data: { balanceMinor: { increment: params.amountMinor } },
      }),
    ]);

    // Запись транзакции и системное сообщение в тикете
    await this.prisma.$transaction([
      this.prisma.transaction.create({
        data: {
          userId: ticket.userId,
          type,
          status: 'COMPLETED',
          amountMinor: params.amountMinor,
          balanceAfterMinor: updatedUser.balanceMinor,
          idempotencyKey: `admin:balance:${ticket.id}:${Date.now()}`,
          referenceType: 'ticket',
          referenceId: ticket.id,
          description: params.reason,
        },
      }),
      this.prisma.message.create({
        data: {
          ticketId: ticket.id,
          authorId: null,
          kind: 'ACTION',
          body:
            params.amountMinor >= 0n
              ? `Администратор (${actor?.username ?? params.actorId}) начислил ${(Number(absAmount) / 100).toFixed(2)} AZN. Причина: ${params.reason}`
              : `Администратор (${actor?.username ?? params.actorId}) списал ${(Number(absAmount) / 100).toFixed(2)} AZN. Причина: ${params.reason}`,
        },
      }),
    ]);

    await this.audit.log({
      actorId: params.actorId,
      action: 'user.balance_adjust',
      entityType: 'user',
      entityId: ticket.userId,
      payload: { ticketId: ticket.id, amountMinor: params.amountMinor.toString(), reason: params.reason },
      ip: params.ip,
      userAgent: params.userAgent,
    });

    return { balanceAfterMinor: updatedUser.balanceMinor.toString() };
  }

  async close(params: { actorId: string; ticketId: string; ip?: string; userAgent?: string }) {
    const t = await this.prisma.ticket.findUnique({ where: { id: params.ticketId } });
    if (!t) throw new NotFoundException('TICKET_NOT_FOUND');
    if (t.status === 'CLOSED') return t;
    const updated = await this.prisma.ticket.update({
      where: { id: t.id },
      data: { status: 'CLOSED', closedAt: new Date(), moderatorId: t.moderatorId ?? params.actorId },
    });
    await this.audit.log({
      actorId: params.actorId,
      action: 'ticket.close',
      entityType: 'ticket',
      entityId: t.id,
      ip: params.ip,
      userAgent: params.userAgent,
    });
    try {
      this.realtime.emitToTicket(t.id, 'ticket:status', {
        ticketId: t.id,
        status: 'CLOSED',
        closedAt: updated.closedAt?.toISOString() ?? null,
      });
    } catch {
      // не блокируем
    }
    return updated;
  }
}
