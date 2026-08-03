import { apiFetch } from './client';

export interface LotteryPrizeDto {
  symbol: number;
  multiplierBps: number;
  prizeMinor: string;
  oddsOneIn: number;
}

export interface LotteryInfoDto {
  betMinor: string;
  prizes: LotteryPrizeDto[];
}

export interface LotteryTicketDto {
  id: string;
  betMinor: string;
  prizeMinor: string;
  symbols: number[];
  winningSymbol: number | null;
  multiplierBps: number | null;
  balanceMinor: string;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  createdAt: string;
}

export interface LotteryHistoryItemDto {
  id: string;
  betMinor: string;
  prizeMinor: string;
  symbols: number[];
  winningSymbol: number | null;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  createdAt: string;
}

export const lotteryApi = {
  info: (cookieHeader?: string) =>
    apiFetch<LotteryInfoDto>('/lottery/info', {
      ...(cookieHeader ? { headers: { cookie: cookieHeader } } : {}),
    }),

  buy: (clientSeed?: string) =>
    apiFetch<LotteryTicketDto>('/lottery/buy', {
      method: 'POST',
      body: clientSeed ? { clientSeed } : {},
    }),

  history: (params: { limit?: number; cursor?: string; cookieHeader?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.limit) q.set('limit', String(params.limit));
    if (params.cursor) q.set('cursor', params.cursor);
    const qs = q.toString();
    return apiFetch<{ items: LotteryHistoryItemDto[]; nextCursor: string | null }>(
      `/lottery/history${qs ? `?${qs}` : ''}`,
      { ...(params.cookieHeader ? { headers: { cookie: params.cookieHeader } } : {}) },
    );
  },
};
