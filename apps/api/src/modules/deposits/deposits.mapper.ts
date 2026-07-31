import type { Deposit } from '@prisma/client';
import { minorToJson } from '@chcgreen/shared';

export interface PublicDepositDto {
  id: string;
  provider: Deposit['provider'];
  paymentMethodId: string | null;
  status: Deposit['status'];
  amountMinor: string;
  externalId: string | null;
  externalAddress: string | null;
  requisiteDetails: { type?: string; bank?: string; owner?: string } | null;
  paymentUrl: string | null;
  originalAmount: string | null;
  originalCurrency: string | null;
  createdAt: string;
  completedAt: string | null;
  expiresAt: string | null;
}

export function toPublicDeposit(d: Deposit): PublicDepositDto {
  return {
    id: d.id,
    provider: d.provider,
    paymentMethodId: d.paymentMethodId,
    status: d.status,
    amountMinor: minorToJson(d.amountMinor),
    externalId: d.externalId,
    externalAddress: d.externalAddress,
    requisiteDetails: (d.requisiteDetails ?? null) as PublicDepositDto['requisiteDetails'],
    paymentUrl: d.paymentUrl,
    originalAmount: d.originalAmount,
    originalCurrency: d.originalCurrency,
    createdAt: d.createdAt.toISOString(),
    completedAt: d.completedAt?.toISOString() ?? null,
    expiresAt: d.expiresAt?.toISOString() ?? null,
  };
}
