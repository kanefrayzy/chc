import { apiFetch } from './client';

export type PaymentProviderId = 'BETRA_H2H' | 'WESTWALLET';

export type DepositStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';

export interface DepositDto {
  id: string;
  provider: PaymentProviderId;
  status: DepositStatus;
  amountMinor: string;
  externalId: string | null;
  externalAddress: string | null;
  paymentUrl: string | null;
  originalAmount: string | null;
  originalCurrency: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface DepositsPageDto {
  items: DepositDto[];
  nextCursor: string | null;
}

export interface CreateDepositRequest {
  provider: PaymentProviderId;
  amountMinor: string;
}

export const depositsApi = {
  create: (req: CreateDepositRequest) =>
    apiFetch<DepositDto>('/deposits', {
      method: 'POST',
      body: req,
      credentials: 'include',
    }),
  list: (args: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (args.limit) params.set('limit', String(args.limit));
    if (args.cursor) params.set('cursor', args.cursor);
    const qs = params.toString();
    return apiFetch<DepositsPageDto>(`/deposits${qs ? `?${qs}` : ''}`, {
      credentials: 'include',
    });
  },
};
