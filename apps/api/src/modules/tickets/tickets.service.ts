import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import type { Message, Ticket, TicketType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.module';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async createTicket(params: {
    userId: string;
    type: TicketType;
    subject?: string;
    metadata?: Record<string, unknown>;
    initialMessage?: string;
  }): Promise<Ticket> {
    const ticket = await this.prisma.ticket.create({
      data: {
        userId: params.userId,
        type: params.type,
        status: 'WAITING_MODERATOR',
        subject: params.subject ?? null,
        metadata: (params.metadata ?? undefined) as never,
        messages: params.initialMessage
          ? {
              create: {
                authorId: params.userId,
                kind: 'TEXT',
                body: params.initialMessage,
              },
            }
          : undefined,
      },
    });
    try {
      this.realtime.emitNewTicket({
        id: ticket.id,
        userId: ticket.userId,
        type: ticket.type,
        status: ticket.status,
        subject: ticket.subject,
      });
    } catch { /* non-blocking */ }
    return ticket;
  }

  async listForUser(params: {
    userId: string;
    limit: number;
    cursor?: string;
  }): Promise<{ items: (Ticket & { messages: Message[] })[]; nextCursor: string | null }> {
    const take = Math.min(Math.max(params.limit, 1), 100);
    const items = await this.prisma.ticket.findMany({
      where: { userId: params.userId },
      orderBy: { updatedAt: 'desc' },
      take: take + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    let nextCursor: string | null = null;
    if (items.length > take) {
      const next = items.pop();
      nextCursor = next?.id ?? null;
    }
    return { items, nextCursor };
  }

  async getForUser(params: { userId: string; ticketId: string }): Promise<Ticket> {
    const t = await this.prisma.ticket.findUnique({ where: { id: params.ticketId } });
    if (!t) throw new NotFoundException('TICKET_NOT_FOUND');
    if (t.userId !== params.userId) throw new ForbiddenException('TICKET_FORBIDDEN');
    return t;
  }

  async listMessages(params: {
    userId: string;
    ticketId: string;
    afterId?: string;
    beforeId?: string;
    limit?: number;
  }): Promise<Message[]> {
    await this.getForUser({ userId: params.userId, ticketId: params.ticketId });
    const take = Math.min(Math.max(params.limit ?? 30, 1), 100);
    if (params.beforeId) {
      // Загрузить более старые сообщения (cursor-up)
      const msgs = await this.prisma.message.findMany({
        where: { ticketId: params.ticketId },
        orderBy: { createdAt: 'desc' },
        take,
        cursor: { id: params.beforeId },
        skip: 1,
      });
      return msgs.reverse();
    }
    return this.prisma.message.findMany({
      where: { ticketId: params.ticketId },
      orderBy: { createdAt: 'asc' },
      take,
      ...(params.afterId ? { cursor: { id: params.afterId }, skip: 1 } : {}),
    });
  }

  async postUserMessage(params: { userId: string; ticketId: string; body: string }): Promise<Message> {
    const ticket = await this.getForUser({ userId: params.userId, ticketId: params.ticketId });
    if (ticket.status === 'CLOSED') {
      throw new BadRequestException('TICKET_CLOSED');
    }
    const [, message, author] = await this.prisma.$transaction([
      this.prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: 'WAITING_MODERATOR' },
      }),
      this.prisma.message.create({
        data: {
          ticketId: ticket.id,
          authorId: params.userId,
          kind: 'TEXT',
          body: params.body,
        },
      }),
      this.prisma.user.findUniqueOrThrow({
        where: { id: params.userId },
        select: { username: true },
      }),
    ]);
    try {
      this.realtime.emitToTicket(ticket.id, 'ticket:message', {
        id: message.id,
        ticketId: message.ticketId,
        authorId: message.authorId,
        authorUsername: author.username ?? null,
        authorRole: 'USER',
        kind: message.kind,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
      });
      if (ticket.status !== 'WAITING_MODERATOR') {
        this.realtime.emitToTicket(ticket.id, 'ticket:status', {
          ticketId: ticket.id,
          status: 'WAITING_MODERATOR',
          closedAt: null,
        });
      }
      // Уведомляем список тикетов в админке
      this.realtime.emitTicketUpdated(ticket.id, {
        status: 'WAITING_MODERATOR',
        lastMessagePreview: message.body.slice(0, 100),
        lastMessageAt: message.createdAt.toISOString(),
      });
    } catch {
      // не блокируем основной поток
    }
    return message;
  }
}
