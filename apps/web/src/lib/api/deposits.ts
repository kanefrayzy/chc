import { apiFetch } from './client';

export type PaymentProviderId = 'BETATRANSFER' | 'WESTWALLET';

export type DepositStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';

export interface DepositDto {
  id: string;
  provider: PaymentProviderId;
  paymentMethodId: string | null;
  status: DepositStatus;
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

export interface DepositsPageDto {
  items: DepositDto[];
  nextCursor: string | null;
}

export interface CreateDepositRequest {
  paymentMethodId: string;
  amountMinor: string;
}

export const depositsApi = {
  create: (req: CreateDepositRequest) =>
    apiFetch<DepositDto>('/deposits', {
      method: 'POST',
      body: req,
      credentials: 'include',
    }),
  cancel: (id: string) =>
    apiFetch<DepositDto>(`/deposits/${id}/cancel`, {
      method: 'POST',
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
