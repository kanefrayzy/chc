import type { ReferralEarning } from '@prisma/client';
import { minorToJson } from '@chcgreen/shared';

export interface PublicReferralEarningDto {
  id: string;
  referredId: string;
  referredUsername?: string;
  kind: ReferralEarning['kind'];
  sourceAmountMinor: string;
  earningMinor: string;
  rateBps: number;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
}

export function toPublicReferralEarning(
  e: ReferralEarning & { referred?: { username: string } | null },
): PublicReferralEarningDto {
  return {
    id: e.id,
    referredId: e.referredId,
    ...(e.referred ? { referredUsername: e.referred.username } : {}),
    kind: e.kind,
    sourceAmountMinor: minorToJson(e.sourceAmountMinor),
    earningMinor: minorToJson(e.earningMinor),
    rateBps: e.rateBps,
    referenceType: e.referenceType,
    referenceId: e.referenceId,
    createdAt: e.createdAt.toISOString(),
  };
}

export interface ReferralSummaryDto {
  referralCode: string;
  referralsCount: number;
  totalEarningsMinor: string;
  rates: { fromLossBps: number; fromDepositBps: number };
}

export interface ReferralUser {
  id: string;
  username: string;
  createdAt: Date;
  totalWageredMinor: bigint;
  earnedFromMinor: bigint;
}

export interface PublicReferralDto {
  id: string;
  username: string;
  createdAt: string;
  totalWageredMinor: string;
  earnedFromMinor: string;
}

export function toPublicReferral(r: ReferralUser): PublicReferralDto {
  return {
    id: r.id,
    username: r.username,
    createdAt: r.createdAt.toISOString(),
    totalWageredMinor: minorToJson(r.totalWageredMinor),
    earnedFromMinor: minorToJson(r.earnedFromMinor),
  };
}
