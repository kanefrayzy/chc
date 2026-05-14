import type { Withdrawal } from '@prisma/client';
import { minorToJson } from '@chcgreen/shared';

/**
 * Маскирует номер карты до формата `**** **** **** 1234`.
 * Никакие необработанные реквизиты в публичный DTO не возвращаются.
 */
function maskCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  const last4 = digits.slice(-4);
  return `**** **** **** ${last4}`;
}

function maskWalletAddress(raw: string): string {
  if (raw.length <= 10) return raw;
  return `${raw.slice(0, 6)}…${raw.slice(-4)}`;
}

export interface PublicWithdrawalDestination {
  kind: 'card' | 'crypto' | 'manual';
  display: string;
  network?: string;
}

export interface PublicWithdrawalDto {
  id: string;
  method: Withdrawal['method'];
  paymentMethodId: string | null;
  status: Withdrawal['status'];
  amountMinor: string;
  destination: PublicWithdrawalDestination;
  reason: string | null;
  createdAt: string;
  completedAt: string | null;
}

export function toPublicDestination(raw: unknown): PublicWithdrawalDestination {
  const d = raw as { kind?: string; cardNumber?: string; walletAddress?: string; network?: string; details?: string };
  switch (d?.kind) {
    case 'card':
      return { kind: 'card', display: maskCardNumber(d.cardNumber ?? '') };
    case 'crypto':
      return {
        kind: 'crypto',
        display: maskWalletAddress(d.walletAddress ?? ''),
        network: d.network ?? 'TRC20',
      };
    case 'manual':
      return { kind: 'manual', display: (d.details ?? '').slice(0, 80) };
    default:
      return { kind: 'manual', display: '—' };
  }
}

export function toPublicWithdrawal(w: Withdrawal): PublicWithdrawalDto {
  return {
    id: w.id,
    method: w.method,
    paymentMethodId: w.paymentMethodId,
    status: w.status,
    amountMinor: minorToJson(w.amountMinor),
    destination: toPublicDestination(w.destination),
    reason: w.reason,
    createdAt: w.createdAt.toISOString(),
    completedAt: w.completedAt?.toISOString() ?? null,
  };
}
