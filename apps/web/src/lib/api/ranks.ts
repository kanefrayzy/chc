import { apiFetch } from './client';

export interface RankDto {
  id: string;
  order: number;
  slug: string;
  nameRu: string;
  nameAz: string;
  minWageredMinor: string;
  iconUrl: string | null;
}

export interface MyRankProgressDto {
  totalWageredMinor: string;
  current: RankDto | null;
  next: RankDto | null;
  progressBps: number;
}

export const ranksApi = {
  list: (cookieHeader?: string) =>
    apiFetch<{ items: RankDto[] }>('/ranks', {
      ...(cookieHeader ? { headers: { Cookie: cookieHeader } } : {}),
    }),
  me: (cookieHeader?: string) =>
    apiFetch<MyRankProgressDto>('/ranks/me', {
      ...(cookieHeader ? { headers: { Cookie: cookieHeader } } : {}),
      credentials: 'include',
    }),
};
