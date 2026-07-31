import { randomUUID } from 'node:crypto';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.module';
import { debitBalance } from '../../common/balance';
import { AdminAuditService } from './admin-audit.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

/** Потолок одной корректировки баланса из тикета — 10 000 AZN. */
const MAX_TICKET_ADJUST_MINOR = 1_000_000n;

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
    // Возвращаем последние N сообщений в хронологическом порядке
    const msgs = await this.prisma.message.findMany({
      where: { ticketId },
      include: { author: { select: { username: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take,
      ...(params?.afterId ? { cursor: { id: params.afterId }, skip: 1 } : {}),
    });
    return msgs.reverse();
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

    // Emit realtime events BEFORE audit so there's no delay for the client
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
      // Уведомляем клиента о смене статуса
      this.realtime.emitToTicket(ticket.id, 'ticket:status', {
        ticketId: ticket.id,
        status: 'WAITING_USER',
        closedAt: null,
      });
      // Обновляем список тикетов в админке
      this.realtime.emitTicketUpdated(ticket.id, {
        status: 'WAITING_USER',
        lastMessagePreview: message.body.slice(0, 100),
        lastMessageAt: message.createdAt.toISOString(),
      });
    } catch {
      // не блокируем
    }

    // Аудит — не блокируем основной поток
    this.audit.log({
      actorId: params.actorId,
      action: 'ticket.message',
      entityType: 'ticket',
      entityId: ticket.id,
      payload: { messageId: message.id },
      ip: params.ip,
      userAgent: params.userAgent,
    }).catch(() => {});

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

    // Ограничение суммы одной корректировки: без него скомпрометированный аккаунт
    // модератора мог начислить себе любой баланс через собственный тикет.
    if (absAmount > MAX_TICKET_ADJUST_MINOR) {
      throw new BadRequestException('ADJUST_AMOUNT_TOO_LARGE');
    }

    const actor = await this.prisma.user.findUnique({
      where: { id: params.actorId },
      select: { username: true, role: true },
    });
    // Модератор не может корректировать баланс сам себе.
    if (ticket.userId === params.actorId) {
      throw new ForbiddenException('CANNOT_ADJUST_OWN_BALANCE');
    }

    // Всё одной транзакцией: деньги и запись в леджере не должны расходиться.
    const updatedUser = await this.prisma.$transaction(async (tx) => {
      if (params.amountMinor < 0n) {
        // Списание — через атомарную проверку средств (баланс не уйдёт в минус)
        const balanceAfter = await debitBalance(tx, ticket.userId, absAmount);
        await tx.transaction.create({
          data: {
            userId: ticket.userId,
            type,
            status: 'COMPLETED',
            amountMinor: params.amountMinor,
            balanceAfterMinor: balanceAfter,
            idempotencyKey: `admin:balance:${ticket.id}:${randomUUID()}`,
            referenceType: 'ticket',
            referenceId: ticket.id,
            description: params.reason,
          },
        });
        return { balanceMinor: balanceAfter };
      }

      const user = await tx.user.update({
        where: { id: ticket.userId },
        data: { balanceMinor: { increment: params.amountMinor } },
        select: { balanceMinor: true },
      });
      await tx.transaction.create({
        data: {
          userId: ticket.userId,
          type,
          status: 'COMPLETED',
          amountMinor: params.amountMinor,
          balanceAfterMinor: user.balanceMinor,
          idempotencyKey: `admin:balance:${ticket.id}:${randomUUID()}`,
          referenceType: 'ticket',
          referenceId: ticket.id,
          description: params.reason,
        },
      });
      return user;
    });

    await this.prisma.message.create({
      data: {
        ticketId: ticket.id,
        authorId: null,
        kind: 'ACTION',
        body:
          params.amountMinor >= 0n
            ? `Администратор (${actor?.username ?? params.actorId}) начислил ${(Number(absAmount) / 100).toFixed(2)} AZN. Причина: ${params.reason}`
            : `Администратор (${actor?.username ?? params.actorId}) списал ${(Number(absAmount) / 100).toFixed(2)} AZN. Причина: ${params.reason}`,
      },
    });

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
