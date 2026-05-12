import type { Deposit } from '@prisma/client';
import { minorToJson } from '@chcgreen/shared';

export interface PublicDepositDto {
  id: string;
  provider: Deposit['provider'];
  status: Deposit['status'];
  amountMinor: string;
  externalId: string | null;
  externalAddress: string | null;
  paymentUrl: string | null;
  originalAmount: string | null;
  originalCurrency: string | null;
  createdAt: string;
  completedAt: string | null;
}

export function toPublicDeposit(d: Deposit): PublicDepositDto {
  return {
    id: d.id,
    provider: d.provider,
    status: d.status,
    amountMinor: minorToJson(d.amountMinor),
    externalId: d.externalId,
    externalAddress: d.externalAddress,
    paymentUrl: d.paymentUrl,
    originalAmount: d.originalAmount,
    originalCurrency: d.originalCurrency,
    createdAt: d.createdAt.toISOString(),
    completedAt: d.completedAt?.toISOString() ?? null,
  };
}
