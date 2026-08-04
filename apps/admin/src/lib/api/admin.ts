import { apiFetch, ApiException, getApiBaseUrl } from './client';

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

// ─── Roulette ────────────────────────────────────────────────────────────

export interface AdminRouletteRoundRow {
  id: string;
  status: string;
  winningColor: string | null;
  winningSlot: number | null;
  betsCount: number;
  totalBetsMinor: string;
  totalPayoutsMinor: string;
  ggrMinor: string;
  startedAt: string;
  completedAt: string | null;
}

export interface AdminRouletteStats {
  todayGgrMinor: string;
  todayBetsMinor: string;
  todayGgrPct: number;
  allTimeGgrMinor: string;
  roundsToday: number;
  roundsTotal: number;
  recentRounds: AdminRouletteRoundRow[];
}

// ─── Mines ───────────────────────────────────────────────────────────────

export interface AdminMinesGameRow {
  id: string;
  username: string;
  status: string;
  mineCount: number;
  revealedCount: number;
  betMinor: string;
  payoutMinor: string;
  ggrMinor: string;
  multiplierBps: number;
  startedAt: string;
  completedAt: string | null;
}

export interface AdminMinesByMineCountRow {
  mineCount: number;
  games: number;
  wageredMinor: string;
  paidOutMinor: string;
  ggrMinor: string;
  rtpPct: number;
}

export interface AdminMinesStats {
  todayGgrMinor: string;
  todayWageredMinor: string;
  todayPaidOutMinor: string;
  todayGgrPct: number;
  allTimeGgrMinor: string;
  allTimeWageredMinor: string;
  allTimePaidOutMinor: string;
  allTimeRtpPct: number;
  gamesToday: number;
  gamesTotal: number;
  activeGames: number;
  cashedOutTotal: number;
  bustedTotal: number;
  bustedPct: number;
  byMineCount: AdminMinesByMineCountRow[];
  recentGames: AdminMinesGameRow[];
}

// ─── Dashboard ───────────────────────────────────────────────────────────

export interface DashboardStats {
  pendingWithdrawalsCount: number;
  pendingWithdrawalsAmountMinor: string;
  openCodePurchasesCount: number;
  openTicketsCount: number;
  usersTotal: number;
  usersActive24h: number;
  depositsAllTimeCount: number;
  depositsAllTimeAmountMinor: string;
  depositsTodayCount: number;
  depositsTodayAmountMinor: string;
  ftdUsersCount: number;
  totalUsersBalanceMinor: string;
  completedWithdrawalsAmountMinor: string;
}

export interface TimeseriesPoint {
  date: string;
  registrations: number;
  depositsCount: number;
  depositsAmountMinor: string;
  withdrawalsCount: number;
  withdrawalsAmountMinor: string;
  ggrMinor: string;
}

export interface TimeseriesTotals {
  registrations: number;
  depositsCount: number;
  depositsAmountMinor: string;
  withdrawalsCount: number;
  withdrawalsAmountMinor: string;
  ggrMinor: string;
  netMinor: string;
}

export interface DashboardTimeseries {
  days: number;
  points: TimeseriesPoint[];
  totals: TimeseriesTotals;
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
  userBalanceMinor: string | null;
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
  method: 'AUTO_BETATRANSFER' | 'AUTO_WESTWALLET' | 'MANUAL_MODERATOR';
  status: WithdrawalStatus;
  amountMinor: string;
  destination: { kind: 'card' | 'crypto' | 'manual'; display: string; network?: string };
  reason: string | null;
  externalId: string | null;
  processedByModeratorId: string | null;
  createdAt: string;
  completedAt: string | null;
}

/** Ответ Betatransfer о состоянии выплаты (ручная сверка, когда колбэк не дошёл). */
export interface PayoutStatusInfo {
  applied: boolean;
  status: 'COMPLETED' | 'FAILED' | 'PENDING';
  providerStatus: string;
  providerId: string | null;
  amount: string | null;
  currency: string | null;
  commission: string | null;
  paymentSystem: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

// ─── Deposits / transactions ─────────────────────────────────────────────

export type DepositStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface AdminDepositRow {
  id: string;
  username: string | null;
  methodName: string | null;
  provider: 'BETATRANSFER' | 'WESTWALLET';
  status: DepositStatus;
  amountMinor: string;
  originalAmount: string | null;
  originalCurrency: string | null;
  /** Номер заказа на стороне провайдера. */
  providerId: string | null;
  requisite: string | null;
  requisiteBank: string | null;
  requisiteOwner: string | null;
  paymentUrl: string | null;
  createdAt: string;
  completedAt: string | null;
  expiresAt: string | null;
}

export interface AdminDepositStat {
  status: DepositStatus;
  count: number;
  totalMinor: string;
}

// ─── Code shop ───────────────────────────────────────────────────────────

export interface AdminCodeProduct {
  id: string;
  name: string;
  denominationMinor: string;
  priceMinor: string;
  description: string | null;
  displayOrder: number;
  enabled: boolean;
  stock: number;
  soldCount: number;
}

export interface AdminCodeItem {
  id: string;
  code: string;
  status: 'AVAILABLE' | 'SOLD' | 'DISABLED';
  soldTo: string | null;
  soldAt: string | null;
}

export interface AdminCodeSale {
  id: string;
  code: string;
  productName: string;
  denominationMinor: string;
  priceMinor: string;
  username: string | null;
  soldAt: string | null;
}

// ─── Progressive jackpot ─────────────────────────────────────────────────

export type JackpotTier = 'GRAND' | 'MAJOR' | 'MINOR' | 'MINI';

export interface AdminJackpotRow {
  tier: JackpotTier;
  seedMinor: string;
  currentMinor: string;
  contributionBps: number;
  enabled: boolean;
  lastWinnerName: string | null;
  lastWinMinor: string;
  lastWonAt: string | null;
}

export interface AdminJackpotWin {
  id: string;
  tier: JackpotTier;
  username: string | null;
  amountMinor: string;
  createdAt: string;
}

// ─── Tickets ─────────────────────────────────────────────────────────────

export type TicketStatus = 'OPEN' | 'WAITING_USER' | 'WAITING_MODERATOR' | 'CLOSED';
export type TicketType = 'CODE_PURCHASE' | 'WITHDRAWAL' | 'SUPPORT';

export interface AdminTicketRow {
  id: string;
  userId: string;
  username: string | null;
  userBalanceMinor: string | null;
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

// ─── Ranks ───────────────────────────────────────────────────────────────

export interface AdminRankRow {
  id: string;
  order: number;
  slug: string;
  nameRu: string;
  nameAz: string;
  minWageredMinor: string;
  iconUrl: string | null;
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

// ─── Payment methods ─────────────────────────────────────────────────────

export type PaymentProviderKind = 'BETATRANSFER' | 'WESTWALLET';
export type PaymentMethodKind = 'DEPOSIT' | 'WITHDRAWAL' | 'BOTH';

export interface AdminPaymentMethodRow {
  id: string;
  name: string;
  provider: PaymentProviderKind;
  kind: PaymentMethodKind;
  currency: string;
  iconUrl: string | null;
  description: string | null;
  minAmountMinor: string;
  maxAmountMinor: string;
  displayOrder: number;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentMethodInput {
  name: string;
  provider: PaymentProviderKind;
  kind: PaymentMethodKind;
  currency: string;
  description?: string | null;
  minAmountMinor: string;
  maxAmountMinor: string;
  displayOrder: number;
  enabled: boolean;
  config?: Record<string, unknown>;
}

/** Одна строка словаря переводов: путь ключа, дефолт из файла и текущее значение. */
export interface TranslationEntry {
  key: string;
  defaultValue: string;
  value: string;
  overridden: boolean;
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

  dashboardTimeseries: (days: number, opts?: FetchOptions) =>
    apiFetch<DashboardTimeseries>(`/admin/dashboard/timeseries?days=${days}`, { ...withCookie(opts) }),

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
    setRole: (id: string, body: { role: 'USER' | 'MODERATOR' | 'SUPER_ADMIN' }) =>
      apiFetch<AdminUserRow>(`/admin/users/${id}/role`, { method: 'POST', body }),
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
    issue: (id: string, body: { code: string; amountMinor: string }) =>
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
    payoutStatus: (id: string) =>
      apiFetch<PayoutStatusInfo>(`/admin/withdrawals/${id}/payout-status`, { method: 'POST' }),
  },

  codeShop: {
    products: (opts?: FetchOptions) =>
      apiFetch<{ items: AdminCodeProduct[] }>('/admin/code-shop/products', { ...withCookie(opts) }),
    createProduct: (body: {
      name: string;
      denominationMinor: string;
      priceMinor: string;
      description?: string;
      displayOrder?: number;
      enabled?: boolean;
    }) => apiFetch<{ id: string }>('/admin/code-shop/products', { method: 'POST', body }),
    updateProduct: (
      id: string,
      body: Partial<{
        name: string;
        denominationMinor: string;
        priceMinor: string;
        description: string | null;
        displayOrder: number;
        enabled: boolean;
      }>,
    ) => apiFetch<{ ok: true }>(`/admin/code-shop/products/${id}`, { method: 'PATCH', body }),
    deleteProduct: (id: string) =>
      apiFetch<{ ok: true }>(`/admin/code-shop/products/${id}`, { method: 'DELETE' }),
    addCodes: (id: string, codes: string) =>
      apiFetch<{ added: number; skipped: number }>(`/admin/code-shop/products/${id}/codes`, {
        method: 'POST',
        body: { codes },
      }),
    listCodes: (id: string, status?: 'AVAILABLE' | 'SOLD') =>
      apiFetch<{ items: AdminCodeItem[] }>(
        `/admin/code-shop/products/${id}/codes${status ? `?status=${status}` : ''}`,
      ),
    deleteCode: (id: string) =>
      apiFetch<{ ok: true }>(`/admin/code-shop/codes/${id}`, { method: 'DELETE' }),
    sales: (params: { limit?: number; cursor?: string } = {}, opts?: FetchOptions) => {
      const qs = new URLSearchParams();
      if (params.limit) qs.set('limit', String(params.limit));
      if (params.cursor) qs.set('cursor', params.cursor);
      const q = qs.toString();
      return apiFetch<Page<AdminCodeSale>>(`/admin/code-shop/sales${q ? `?${q}` : ''}`, {
        ...withCookie(opts),
      });
    },
  },

  deposits: {
    list: (
      params: { status?: string; provider?: string; search?: string; limit?: number; cursor?: string },
      opts?: FetchOptions,
    ) => {
      const qs = new URLSearchParams();
      if (params.status) qs.set('status', params.status);
      if (params.provider) qs.set('provider', params.provider);
      if (params.search) qs.set('search', params.search);
      if (params.limit) qs.set('limit', String(params.limit));
      if (params.cursor) qs.set('cursor', params.cursor);
      const q = qs.toString();
      return apiFetch<Page<AdminDepositRow>>(`/admin/deposits${q ? `?${q}` : ''}`, {
        ...withCookie(opts),
      });
    },
    stats: (opts?: FetchOptions) =>
      apiFetch<{ items: AdminDepositStat[] }>('/admin/deposits/stats', { ...withCookie(opts) }),
  },

  progressive: {
    list: (opts?: FetchOptions) =>
      apiFetch<{ items: AdminJackpotRow[] }>('/admin/progressive', { ...withCookie(opts) }),
    wins: (opts?: FetchOptions) =>
      apiFetch<{ items: AdminJackpotWin[] }>('/admin/progressive/wins', { ...withCookie(opts) }),
    update: (
      tier: string,
      body: Partial<{
        seedMinor: string;
        currentMinor: string;
        contributionBps: number;
        enabled: boolean;
      }>,
    ) => apiFetch<{ ok: true }>(`/admin/progressive/${tier}`, { method: 'PATCH', body }),
    award: (tier: string, userId: string) =>
      apiFetch<{ id: string; tier: string; username: string; amountMinor: string }>(
        `/admin/progressive/${tier}/award`,
        { method: 'POST', body: { userId } },
      ),
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
    messages: (id: string, params?: { beforeId?: string; afterId?: string; limit?: number }, opts?: FetchOptions) => {
      const qs = new URLSearchParams();
      if (params?.beforeId) qs.set('beforeId', params.beforeId);
      if (params?.afterId) qs.set('afterId', params.afterId);
      if (params?.limit) qs.set('limit', String(params.limit));
      const q = qs.toString();
      return apiFetch<AdminMessage[]>(`/admin/tickets/${id}/messages${q ? `?${q}` : ''}`, { ...withCookie(opts) });
    },
    send: (id: string, body: { body: string }) =>
      apiFetch<AdminMessage>(`/admin/tickets/${id}/messages`, { method: 'POST', body }),
    uploadImage: async (id: string, file: File): Promise<AdminMessage> => {
      const url = `${getApiBaseUrl()}/admin/tickets/${id}/upload-image`;
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(url, {
        method: 'POST',
        body: form,
        credentials: 'include',
        cache: 'no-store',
      });
      const text = await res.text();
      const data = text ? (JSON.parse(text) as unknown) : null;
      if (!res.ok) throw new ApiException(res.status, data as null);
      return data as AdminMessage;
    },
    close: (id: string) =>
      apiFetch<AdminTicketRow>(`/admin/tickets/${id}/close`, { method: 'POST' }),
    balanceAdjust: (id: string, body: { amountMinor: string; reason: string }) =>
      apiFetch<{ balanceAfterMinor: string }>(`/admin/tickets/${id}/balance-adjust`, { method: 'POST', body }),
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

  ranks: {
    list: (opts?: FetchOptions) =>
      apiFetch<{ items: AdminRankRow[] }>('/admin/ranks', { ...withCookie(opts) }),
    create: (body: Omit<AdminRankRow, 'id'>) =>
      apiFetch<AdminRankRow>('/admin/ranks', { method: 'POST', body }),
    update: (id: string, body: Partial<Omit<AdminRankRow, 'id'>>) =>
      apiFetch<AdminRankRow>(`/admin/ranks/${id}`, { method: 'PATCH', body }),
    remove: (id: string) =>
      apiFetch<void>(`/admin/ranks/${id}`, { method: 'DELETE' }),
    uploadIcon: async (id: string, file: File): Promise<AdminRankRow> => {
      const url = `${getApiBaseUrl()}/admin/ranks/${id}/upload-icon`;
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(url, {
        method: 'POST',
        body: form,
        credentials: 'include',
        cache: 'no-store',
      });
      const text = await res.text();
      const data = text ? (JSON.parse(text) as unknown) : null;
      if (!res.ok) {
        throw new ApiException(res.status, data as null);
      }
      return data as AdminRankRow;
    },
  },

  paymentMethods: {
    list: (opts?: FetchOptions) =>
      apiFetch<{ items: AdminPaymentMethodRow[] }>('/admin/payment-methods', { ...withCookie(opts) }),
    get: (id: string, opts?: FetchOptions) =>
      apiFetch<AdminPaymentMethodRow>(`/admin/payment-methods/${id}`, { ...withCookie(opts) }),
    create: (body: PaymentMethodInput) =>
      apiFetch<AdminPaymentMethodRow>('/admin/payment-methods', { method: 'POST', body }),
    update: (id: string, body: Partial<PaymentMethodInput>) =>
      apiFetch<AdminPaymentMethodRow>(`/admin/payment-methods/${id}`, { method: 'PATCH', body }),
    remove: (id: string) =>
      apiFetch<void>(`/admin/payment-methods/${id}`, { method: 'DELETE' }),
    uploadIcon: async (id: string, file: File): Promise<AdminPaymentMethodRow> => {
      const url = `${getApiBaseUrl()}/admin/payment-methods/${id}/upload-icon`;
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(url, {
        method: 'POST',
        body: form,
        credentials: 'include',
        cache: 'no-store',
      });
      const text = await res.text();
      const data = text ? (JSON.parse(text) as unknown) : null;
      if (!res.ok) {
        throw new ApiException(res.status, data as null);
      }
      return data as AdminPaymentMethodRow;
    },
  },

  settings: {
    list: (opts?: FetchOptions) =>
      apiFetch<{ items: AdminSettingRow[] }>('/admin/settings', { ...withCookie(opts) }),
    set: (key: string, value: unknown) =>
      apiFetch<AdminSettingRow>(`/admin/settings/${encodeURIComponent(key).replace(/\./g, '%2E')}`, {
        method: 'POST',
        body: { value },
      }),
    uploadLogo: async (file: File): Promise<AdminSettingRow> => {
      const url = `${getApiBaseUrl()}/admin/settings/upload-logo`;
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(url, {
        method: 'POST',
        body: form,
        credentials: 'include',
        cache: 'no-store',
      });
      const text = await res.text();
      const data = text ? (JSON.parse(text) as unknown) : null;
      if (!res.ok) {
        throw new ApiException(res.status, data as null);
      }
      return data as AdminSettingRow;
    },
    uploadImage: async (key: string, file: File): Promise<AdminSettingRow> => {
      const url = `${getApiBaseUrl()}/admin/settings/upload-image/${encodeURIComponent(key).replace(/\./g, '%2E')}`;
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(url, {
        method: 'POST',
        body: form,
        credentials: 'include',
        cache: 'no-store',
      });
      const text = await res.text();
      const data = text ? (JSON.parse(text) as unknown) : null;
      if (!res.ok) {
        throw new ApiException(res.status, data as null);
      }
      return data as AdminSettingRow;
    },
  },

  roulette: {
    stats: (opts?: FetchOptions) =>
      apiFetch<AdminRouletteStats>('/admin/roulette/stats', { ...withCookie(opts) }),
  },

  mines: {
    stats: (opts?: FetchOptions) =>
      apiFetch<AdminMinesStats>('/admin/mines/stats', { ...withCookie(opts) }),
  },

  translations: {
    get: (locale: 'ru' | 'az', opts?: FetchOptions) =>
      apiFetch<{
        locale: string;
        isCustom: boolean;
        entries: TranslationEntry[];
        messages: Record<string, unknown>;
      }>(`/admin/translations/${locale}`, { ...withCookie(opts) }),
    /** Точечная правка: null сбрасывает ключ к встроенному значению. */
    patch: (locale: 'ru' | 'az', entries: Record<string, string | null>) =>
      apiFetch<{ locale: string; isCustom: boolean; changed: number }>(
        `/admin/translations/${locale}`,
        { method: 'PATCH', body: { entries } },
      ),
    save: (locale: 'ru' | 'az', messages: Record<string, unknown>) =>
      apiFetch<{ locale: string; isCustom: boolean }>(`/admin/translations/${locale}`, {
        method: 'POST',
        body: { messages },
      }),
    reset: (locale: 'ru' | 'az') =>
      apiFetch<{ locale: string; isCustom: boolean }>(`/admin/translations/${locale}/reset`, {
        method: 'POST',
      }),
  },

  exchangeRates: {
    refresh: () =>
      apiFetch<{ usd: number; rub: number; try: number }>('/admin/exchange-rates/refresh', {
        method: 'POST',
      }),
  },
};
