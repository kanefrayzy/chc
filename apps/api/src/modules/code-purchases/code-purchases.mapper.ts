import type { CodePurchase } from '@prisma/client';
import { minorToJson } from '@chcgreen/shared';

export interface PublicCodePurchaseDto {
  id: string;
  status: CodePurchase['status'];
  amountMinor: string;
  ticketId: string | null;
  /** Полный код виден только после выдачи модератором. */
  code: string | null;
  createdAt: string;
  completedAt: string | null;
}

export function toPublicCodePurchase(p: CodePurchase): PublicCodePurchaseDto {
  return {
    id: p.id,
    status: p.status,
    amountMinor: minorToJson(p.amountMinor),
    ticketId: p.ticketId,
    code: p.status === 'CODE_ISSUED' || p.status === 'COMPLETED' ? p.code : null,
    createdAt: p.createdAt.toISOString(),
    completedAt: p.completedAt?.toISOString() ?? null,
  };
}
