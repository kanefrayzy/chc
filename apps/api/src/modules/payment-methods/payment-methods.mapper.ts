import type { PaymentMethod } from '@prisma/client';
import type { PaymentMethodConfig } from './payment-methods.dto';

/** Публичная (видимая клиенту) карточка метода. */
export interface PublicPaymentMethodDto {
  id: string;
  name: string;
  provider: 'BETRA_H2H' | 'WESTWALLET';
  kind: 'DEPOSIT' | 'WITHDRAWAL' | 'BOTH';
  currency: string;
  iconUrl: string | null;
  description: string | null;
  minAmountMinor: string;
  maxAmountMinor: string;
  displayOrder: number;
}

/** Полная (админская) карточка метода с конфигом. */
export interface AdminPaymentMethodDto extends PublicPaymentMethodDto {
  enabled: boolean;
  config: PaymentMethodConfig;
  createdAt: string;
  updatedAt: string;
}

export function toPublicPaymentMethod(m: PaymentMethod): PublicPaymentMethodDto {
  return {
    id: m.id,
    name: m.name,
    provider: m.provider,
    kind: m.kind,
    currency: m.currency,
    iconUrl: m.iconUrl,
    description: m.description,
    minAmountMinor: m.minAmountMinor.toString(),
    maxAmountMinor: m.maxAmountMinor.toString(),
    displayOrder: m.displayOrder,
  };
}

export function toAdminPaymentMethod(m: PaymentMethod): AdminPaymentMethodDto {
  return {
    ...toPublicPaymentMethod(m),
    enabled: m.enabled,
    config: (m.config ?? {}) as PaymentMethodConfig,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}
