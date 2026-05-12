import type { Message, Ticket } from '@prisma/client';

export interface PublicMessageDto {
  id: string;
  ticketId: string;
  authorId: string | null;
  kind: Message['kind'];
  body: string;
  createdAt: string;
  isMine: boolean;
}

export interface PublicTicketDto {
  id: string;
  type: Ticket['type'];
  status: Ticket['status'];
  subject: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
}

export function toPublicMessage(m: Message, viewerId: string): PublicMessageDto {
  return {
    id: m.id,
    ticketId: m.ticketId,
    authorId: m.authorId,
    kind: m.kind,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    isMine: m.authorId === viewerId,
  };
}

export function toPublicTicket(
  t: Ticket & { messages?: Message[] },
): PublicTicketDto {
  const last = t.messages?.[0];
  return {
    id: t.id,
    type: t.type,
    status: t.status,
    subject: t.subject,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    closedAt: t.closedAt?.toISOString() ?? null,
    lastMessagePreview: last ? last.body.slice(0, 120) : null,
    lastMessageAt: last ? last.createdAt.toISOString() : null,
  };
}
