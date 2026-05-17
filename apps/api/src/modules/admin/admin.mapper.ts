import type { CodePurchase, Message, Ticket, User, Withdrawal, AuditLog } from '@prisma/client';
import { minorToJson } from '@chcgreen/shared';
import { toPublicDestination, type PublicWithdrawalDestination } from '../withdrawals/withdrawals.mapper';

export interface AdminUserRowDto {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  role: User['role'];
  status: User['status'];
  language: User['language'];
  balanceMinor: string;
  totalWageredMinor: string;
  referralCode: string;
  referredById: string | null;
  rankId: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export function toAdminUser(u: User): AdminUserRowDto {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    phone: u.phone,
    role: u.role,
    status: u.status,
    language: u.language,
    balanceMinor: minorToJson(u.balanceMinor),
    totalWageredMinor: minorToJson(u.totalWageredMinor),
    referralCode: u.referralCode,
    referredById: u.referredById,
    rankId: u.rankId,
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
  };
}

export interface AdminWithdrawalRowDto {
  id: string;
  userId: string;
  username: string | null;
  method: Withdrawal['method'];
  status: Withdrawal['status'];
  amountMinor: string;
  destination: PublicWithdrawalDestination;
  reason: string | null;
  externalId: string | null;
  processedByModeratorId: string | null;
  createdAt: string;
  completedAt: string | null;
}

export function toAdminWithdrawal(
  w: Withdrawal & { user?: { username: string } | null },
): AdminWithdrawalRowDto {
  return {
    id: w.id,
    userId: w.userId,
    username: w.user?.username ?? null,
    method: w.method,
    status: w.status,
    amountMinor: minorToJson(w.amountMinor),
    destination: toPublicDestination(w.destination),
    reason: w.reason,
    externalId: w.externalId,
    processedByModeratorId: w.processedByModeratorId,
    createdAt: w.createdAt.toISOString(),
    completedAt: w.completedAt ? w.completedAt.toISOString() : null,
  };
}

export interface AdminCodePurchaseRowDto {
  id: string;
  userId: string;
  username: string | null;
  userBalanceMinor: string | null;
  ticketId: string | null;
  amountMinor: string;
  status: CodePurchase['status'];
  code: string | null;
  issuedByModeratorId: string | null;
  createdAt: string;
  completedAt: string | null;
}

export function toAdminCodePurchase(
  p: CodePurchase & { user?: { username: string; balanceMinor?: bigint } | null },
): AdminCodePurchaseRowDto {
  return {
    id: p.id,
    userId: p.userId,
    username: p.user?.username ?? null,
    userBalanceMinor:
      p.user?.balanceMinor !== undefined && p.user.balanceMinor !== null
        ? minorToJson(p.user.balanceMinor)
        : null,
    ticketId: p.ticketId,
    amountMinor: minorToJson(p.amountMinor),
    status: p.status,
    code: p.code,
    issuedByModeratorId: p.issuedByModeratorId,
    createdAt: p.createdAt.toISOString(),
    completedAt: p.completedAt ? p.completedAt.toISOString() : null,
  };
}

export interface AdminTicketRowDto {
  id: string;
  userId: string;
  username: string | null;
  userBalanceMinor: string | null;
  moderatorId: string | null;
  moderatorUsername: string | null;
  type: Ticket['type'];
  status: Ticket['status'];
  subject: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export function toAdminTicket(
  t: Ticket & {
    user?: { username: string; balanceMinor?: bigint } | null;
    moderator?: { username: string } | null;
    messages?: Message[];
  },
): AdminTicketRowDto {
  const last = t.messages?.[0];
  return {
    id: t.id,
    userId: t.userId,
    username: t.user?.username ?? null,
    userBalanceMinor:
      t.user?.balanceMinor !== undefined && t.user.balanceMinor !== null
        ? minorToJson(t.user.balanceMinor)
        : null,
    moderatorId: t.moderatorId,
    moderatorUsername: t.moderator?.username ?? null,
    type: t.type,
    status: t.status,
    subject: t.subject,
    lastMessagePreview: last ? last.body.slice(0, 120) : null,
    lastMessageAt: last ? last.createdAt.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    closedAt: t.closedAt ? t.closedAt.toISOString() : null,
  };
}

export interface AdminMessageDto {
  id: string;
  ticketId: string;
  authorId: string | null;
  authorUsername: string | null;
  authorRole: User['role'] | null;
  kind: Message['kind'];
  body: string;
  createdAt: string;
}

export function toAdminMessage(
  m: Message & { author?: { username: string; role: User['role'] } | null },
): AdminMessageDto {
  return {
    id: m.id,
    ticketId: m.ticketId,
    authorId: m.authorId,
    authorUsername: m.author?.username ?? null,
    authorRole: m.author?.role ?? null,
    kind: m.kind,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
  };
}

export interface AdminAuditRowDto {
  id: string;
  actorId: string | null;
  actorUsername: string | null;
  actorRole: User['role'] | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  payload: unknown;
  ip: string | null;
  createdAt: string;
}

export function toAdminAudit(
  a: AuditLog & { actor?: { id: string; username: string; role: User['role'] } | null },
): AdminAuditRowDto {
  return {
    id: a.id,
    actorId: a.actorId,
    actorUsername: a.actor?.username ?? null,
    actorRole: a.actor?.role ?? null,
    action: a.action,
    entityType: a.entityType,
    entityId: a.entityId,
    payload: a.payload,
    ip: a.ip,
    createdAt: a.createdAt.toISOString(),
  };
}
