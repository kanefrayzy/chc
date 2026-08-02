import { apiFetch } from './client';

export type ReferralEarningKind = 'FROM_LOSS' | 'FROM_WIN' | 'FROM_DEPOSIT';

export interface ReferralSummaryDto {
  referralCode: string;
  referralsCount: number;
  totalEarningsMinor: string;
  rates: { fromLossBps: number; fromDepositBps: number };
}

export interface ReferralEarningDto {
  id: string;
  referredId: string;
  referredUsername?: string;
  kind: ReferralEarningKind;
  sourceAmountMinor: string;
  earningMinor: string;
  rateBps: number;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
}

export interface ReferralEarningsPageDto {
  items: ReferralEarningDto[];
  nextCursor: string | null;
}

export interface ReferralUserDto {
  id: string;
  username: string;
  createdAt: string;
  totalWageredMinor: string;
  earnedFromMinor: string;
}

export interface ReferralsPageDto {
  items: ReferralUserDto[];
  nextCursor: string | null;
}

export const referralsApi = {
  me: (cookieHeader?: string) =>
    apiFetch<ReferralSummaryDto>('/referrals/me', {
      ...(cookieHeader ? { headers: { Cookie: cookieHeader } } : {}),
      credentials: 'include',
    }),
  earnings: (args: { limit?: number; cursor?: string; cookieHeader?: string } = {}) => {
    const params = new URLSearchParams();
    if (args.limit) params.set('limit', String(args.limit));
    if (args.cursor) params.set('cursor', args.cursor);
    const qs = params.toString();
    return apiFetch<ReferralEarningsPageDto>(`/referrals/earnings${qs ? `?${qs}` : ''}`, {
      ...(args.cookieHeader ? { headers: { Cookie: args.cookieHeader } } : {}),
      credentials: 'include',
    });
  },
  list: (args: { limit?: number; cursor?: string; cookieHeader?: string } = {}) => {
    const params = new URLSearchParams();
    if (args.limit) params.set('limit', String(args.limit));
    if (args.cursor) params.set('cursor', args.cursor);
    const qs = params.toString();
    return apiFetch<ReferralsPageDto>(`/referrals/list${qs ? `?${qs}` : ''}`, {
      ...(args.cookieHeader ? { headers: { Cookie: args.cookieHeader } } : {}),
      credentials: 'include',
    });
  },
};
