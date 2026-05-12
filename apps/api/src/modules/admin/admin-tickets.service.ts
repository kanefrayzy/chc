import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.module';
import { AdminAuditService } from './admin-audit.service';

@Injectable()
export class AdminTicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
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
        user: { select: { username: true } },
        moderator: { select: { username: true } },
      },
    });
    if (!t) throw new NotFoundException('TICKET_NOT_FOUND');
    return t;
  }

  async listMessages(ticketId: string) {
    return this.prisma.message.findMany({
      where: { ticketId },
      include: { author: { select: { username: true, role: true } } },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
  }

  async postMessage(params: {
    actorId: string;
    ticketId: string;
    body: string;
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
          kind: 'TEXT',
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

    return message;
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
    return updated;
  }
}
