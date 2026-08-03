import { apiFetch } from './client';

export type ProgressiveTier = 'GRAND' | 'MAJOR' | 'MINOR' | 'MINI';

export interface ProgressiveJackpotDto {
  tier: ProgressiveTier;
  currentMinor: string;
  enabled: boolean;
}

export interface ProgressiveWinDto {
  tier: ProgressiveTier;
  username: string;
  amountMinor: string;
  createdAt: string;
}

export const progressiveApi = {
  list: (cookieHeader?: string) =>
    apiFetch<{ items: ProgressiveJackpotDto[] }>('/progressive', {
      ...(cookieHeader ? { headers: { cookie: cookieHeader } } : {}),
    }),

  wins: (limit = 5, cookieHeader?: string) =>
    apiFetch<{ items: ProgressiveWinDto[] }>(`/progressive/wins?limit=${limit}`, {
      ...(cookieHeader ? { headers: { cookie: cookieHeader } } : {}),
    }),
};
