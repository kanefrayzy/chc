import { apiFetch } from './client';

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

// ─── Dashboard ───────────────────────────────────────────────────────────

export interface DashboardStats {
  pendingWithdrawalsCount: number;
  pendingWithdrawalsAmountMinor: string;
  openCodePurchasesCount: number;
  openTicketsCount: number;
  usersTotal: number;
  usersActive24h: number;
}

// ─── Users ───────────────────────────────────────────────────────────────

export interface AdminUserRow {
  id: string;
  username: string;
  email: string;
  phone: string;
  role: 'USER' | 'MODERATOR' | 'SUPER_ADMIN';
  status: 'ACTIVE' | 'BANNED' | 'MUTED';
  language: string;
  balanceMinor: string;
  totalWageredMinor: string;
  referralCode: string;
  referredById: string | null;
  rankId: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

// ─── Code purchases ──────────────────────────────────────────────────────

export type CodePurchaseStatus =
  | 'CREATED'
  | 'AWAITING_MODERATOR'
  | 'CODE_ISSUED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface AdminCodePurchaseRow {
  id: string;
  userId: string;
  username: string | null;
  ticketId: string | null;
  amountMinor: string;
  status: CodePurchaseStatus;
  code: string | null;
  issuedByModeratorId: string | null;
  createdAt: string;
  completedAt: string | null;
}

// ─── Withdrawals ─────────────────────────────────────────────────────────

export type WithdrawalStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'FAILED'
  | 'CANCELLED';

export interface AdminWithdrawalRow {
  id: string;
  userId: string;
  username: string | null;
  method: 'AUTO_BETRA_H2H' | 'AUTO_WESTWALLET' | 'MANUAL_MODERATOR';
  status: WithdrawalStatus;
  amountMinor: string;
  destination: { kind: 'card' | 'crypto' | 'manual'; display: string; network?: string };
  reason: string | null;
  externalId: string | null;
  processedByModeratorId: string | null;
  createdAt: string;
  completedAt: string | null;
}

// ─── Tickets ─────────────────────────────────────────────────────────────

export type TicketStatus = 'OPEN' | 'WAITING_USER' | 'WAITING_MODERATOR' | 'CLOSED';
export type TicketType = 'CODE_PURCHASE' | 'WITHDRAWAL' | 'SUPPORT';

export interface AdminTicketRow {
  id: string;
  userId: string;
  username: string | null;
  moderatorId: string | null;
  moderatorUsername: string | null;
  type: TicketType;
  status: TicketStatus;
  subject: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface AdminMessage {
  id: string;
  ticketId: string;
  authorId: string | null;
  authorUsername: string | null;
  authorRole: 'USER' | 'MODERATOR' | 'SUPER_ADMIN' | null;
  kind: 'TEXT' | 'FILE' | 'SYSTEM' | 'ACTION';
  body: string;
  createdAt: string;
}

// ─── Audit ───────────────────────────────────────────────────────────────

export interface AdminAuditRow {
  id: string;
  actorId: string | null;
  actorUsername: string | null;
  actorRole: 'USER' | 'MODERATOR' | 'SUPER_ADMIN' | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  payload: unknown;
  ip: string | null;
  createdAt: string;
}

// ─── Settings ────────────────────────────────────────────────────────────

export type SettingType = 'boolean' | 'string' | 'number' | 'json';

export interface AdminSettingRow {
  key: string;
  value: unknown;
  type: SettingType;
  isPublic: boolean;
  description: string;
  isDefault: boolean;
  updatedAt: string | null;
}

// ─── API client ──────────────────────────────────────────────────────────

interface FetchOptions {
  cookie?: string;
}

function withCookie(opts?: FetchOptions): { headers?: Record<string, string> } {
  return opts?.cookie ? { headers: { Cookie: opts.cookie } } : {};
}

export const adminApi = {
  dashboard: (opts?: FetchOptions) =>
    apiFetch<DashboardStats>('/admin/dashboard', { ...withCookie(opts) }),

  users: {
    list: (params: { search?: string; limit?: number; cursor?: string }, opts?: FetchOptions) => {
      const qs = new URLSearchParams();
      if (params.search) qs.set('search', params.search);
      if (params.limit) qs.set('limit', String(params.limit));
      if (params.cursor) qs.set('cursor', params.cursor);
      const q = qs.toString();
      return apiFetch<Page<AdminUserRow>>(`/admin/users${q ? `?${q}` : ''}`, { ...withCookie(opts) });
    },
    get: (id: string, opts?: FetchOptions) =>
      apiFetch<AdminUserRow>(`/admin/users/${id}`, { ...withCookie(opts) }),
    adjustBalance: (id: string, body: { amountMinor: string; reason: string }) =>
      apiFetch<AdminUserRow>(`/admin/users/${id}/balance-adjust`, { method: 'POST', body }),
    setStatus: (id: string, body: { status: 'ACTIVE' | 'BANNED' | 'MUTED'; reason?: string }) =>
      apiFetch<AdminUserRow>(`/admin/users/${id}/status`, { method: 'POST', body }),
  },

  codePurchases: {
    list: (params: { status?: string; limit?: number; cursor?: string }, opts?: FetchOptions) => {
      const qs = new URLSearchParams();
      if (params.status) qs.set('status', params.status);
      if (params.limit) qs.set('limit', String(params.limit));
      if (params.cursor) qs.set('cursor', params.cursor);
      const q = qs.toString();
      return apiFetch<Page<AdminCodePurchaseRow>>(
        `/admin/code-purchases${q ? `?${q}` : ''}`,
        { ...withCookie(opts) },
      );
    },
    issue: (id: string, body: { code: string }) =>
      apiFetch<AdminCodePurchaseRow>(`/admin/code-purchases/${id}/issue`, { method: 'POST', body }),
    reject: (id: string, body: { reason: string }) =>
      apiFetch<AdminCodePurchaseRow>(`/admin/code-purchases/${id}/reject`, { method: 'POST', body }),
  },

  withdrawals: {
    list: (params: { status?: string; limit?: number; cursor?: string }, opts?: FetchOptions) => {
      const qs = new URLSearchParams();
      if (params.status) qs.set('status', params.status);
      if (params.limit) qs.set('limit', String(params.limit));
      if (params.cursor) qs.set('cursor', params.cursor);
      const q = qs.toString();
      return apiFetch<Page<AdminWithdrawalRow>>(
        `/admin/withdrawals${q ? `?${q}` : ''}`,
        { ...withCookie(opts) },
      );
    },
    approve: (id: string, body: { externalId?: string; note?: string }) =>
      apiFetch<AdminWithdrawalRow>(`/admin/withdrawals/${id}/approve`, { method: 'POST', body }),
    reject: (id: string, body: { reason: string }) =>
      apiFetch<AdminWithdrawalRow>(`/admin/withdrawals/${id}/reject`, { method: 'POST', body }),
  },

  tickets: {
    list: (
      params: { status?: string; type?: string; limit?: number; cursor?: string },
      opts?: FetchOptions,
    ) => {
      const qs = new URLSearchParams();
      if (params.status) qs.set('status', params.status);
      if (params.type) qs.set('type', params.type);
      if (params.limit) qs.set('limit', String(params.limit));
      if (params.cursor) qs.set('cursor', params.cursor);
      const q = qs.toString();
      return apiFetch<Page<AdminTicketRow>>(`/admin/tickets${q ? `?${q}` : ''}`, { ...withCookie(opts) });
    },
    get: (id: string, opts?: FetchOptions) =>
      apiFetch<AdminTicketRow>(`/admin/tickets/${id}`, { ...withCookie(opts) }),
    messages: (id: string, opts?: FetchOptions) =>
      apiFetch<AdminMessage[]>(`/admin/tickets/${id}/messages`, { ...withCookie(opts) }),
    send: (id: string, body: { body: string }) =>
      apiFetch<AdminMessage>(`/admin/tickets/${id}/messages`, { method: 'POST', body }),
    close: (id: string) =>
      apiFetch<AdminTicketRow>(`/admin/tickets/${id}/close`, { method: 'POST' }),
  },

  audit: {
    list: (params: { limit?: number; cursor?: string }, opts?: FetchOptions) => {
      const qs = new URLSearchParams();
      if (params.limit) qs.set('limit', String(params.limit));
      if (params.cursor) qs.set('cursor', params.cursor);
      const q = qs.toString();
      return apiFetch<Page<AdminAuditRow>>(`/admin/audit${q ? `?${q}` : ''}`, { ...withCookie(opts) });
    },
  },

  settings: {
    list: (opts?: FetchOptions) =>
      apiFetch<{ items: AdminSettingRow[] }>('/admin/settings', { ...withCookie(opts) }),
    set: (key: string, value: unknown) =>
      apiFetch<AdminSettingRow>(`/admin/settings/${encodeURIComponent(key)}`, {
        method: 'POST',
        body: { value },
      }),
  },
};
