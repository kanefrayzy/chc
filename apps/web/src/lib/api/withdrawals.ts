import { apiFetch } from './client';

export type WithdrawalMethod = 'AUTO_BETRA_H2H' | 'AUTO_WESTWALLET' | 'MANUAL_MODERATOR';

export type WithdrawalStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'FAILED'
  | 'CANCELLED';

export interface WithdrawalDestinationDto {
  kind: 'card' | 'crypto' | 'manual';
  display: string;
  network?: string;
}

export interface WithdrawalDto {
  id: string;
  method: WithdrawalMethod;
  paymentMethodId: string | null;
  status: WithdrawalStatus;
  amountMinor: string;
  destination: WithdrawalDestinationDto;
  reason: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface WithdrawalsPageDto {
  items: WithdrawalDto[];
  nextCursor: string | null;
}

export type CreateWithdrawalDestination =
  | { kind: 'card'; cardNumber: string; cardHolder?: string }
  | { kind: 'crypto'; walletAddress: string; network?: 'TRC20' }
  | { kind: 'manual'; details: string };

export interface CreateWithdrawalRequest {
  paymentMethodId: string;
  amountMinor: string;
  destination: CreateWithdrawalDestination;
}

export const withdrawalsApi = {
  create: (req: CreateWithdrawalRequest) =>
    apiFetch<WithdrawalDto>('/withdrawals', {
      method: 'POST',
      body: req,
      credentials: 'include',
    }),
  list: (args: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (args.limit) params.set('limit', String(args.limit));
    if (args.cursor) params.set('cursor', args.cursor);
    const qs = params.toString();
    return apiFetch<WithdrawalsPageDto>(`/withdrawals${qs ? `?${qs}` : ''}`, {
      credentials: 'include',
    });
  },
  cancel: (id: string) =>
    apiFetch<WithdrawalDto>(`/withdrawals/${id}/cancel`, {
      method: 'POST',
      credentials: 'include',
    }),
};
