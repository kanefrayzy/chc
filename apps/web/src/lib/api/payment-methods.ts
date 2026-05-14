import { apiFetch } from './client';

export type PaymentProviderId = 'BETRA_H2H' | 'WESTWALLET';
export type PaymentMethodKind = 'DEPOSIT' | 'WITHDRAWAL' | 'BOTH';

export interface PublicPaymentMethod {
  id: string;
  name: string;
  provider: PaymentProviderId;
  kind: PaymentMethodKind;
  currency: string;
  iconUrl: string | null;
  description: string | null;
  minAmountMinor: string;
  maxAmountMinor: string;
  displayOrder: number;
}

export const paymentMethodsApi = {
  list: (kind: 'DEPOSIT' | 'WITHDRAWAL') =>
    apiFetch<{ items: PublicPaymentMethod[] }>(
      `/payment-methods?kind=${kind}`,
      { credentials: 'include' },
    ),
};
