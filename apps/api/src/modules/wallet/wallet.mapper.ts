import { minorToJson } from '@chcgreen/shared';
import type { Transaction, TransactionType, TransactionStatus } from '@prisma/client';

export interface PublicTransactionDto {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amountMinor: string;
  balanceAfterMinor: string;
  description: string | null;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
}

export function toPublicTransaction(tx: Transaction): PublicTransactionDto {
  return {
    id: tx.id,
    type: tx.type,
    status: tx.status,
    amountMinor: minorToJson(tx.amountMinor),
    balanceAfterMinor: minorToJson(tx.balanceAfterMinor),
    description: tx.description,
    referenceType: tx.referenceType,
    referenceId: tx.referenceId,
    createdAt: tx.createdAt.toISOString(),
  };
}
