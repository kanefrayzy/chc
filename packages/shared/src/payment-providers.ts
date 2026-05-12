/**
 * Платёжные провайдеры.
 *
 * `betra_h2h` — фактический ключ интеграции, в UI всегда отображается как «Limpay».
 * См. docs/decisions.md ADR-0004.
 */

export const PAYMENT_PROVIDER = {
  BETRA_H2H: 'betra_h2h',
  WESTWALLET: 'westwallet',
} as const;

export type PaymentProviderKey = (typeof PAYMENT_PROVIDER)[keyof typeof PAYMENT_PROVIDER];

/** Отображаемое имя провайдера для пользователя. */
export const paymentProviderDisplayName: Record<PaymentProviderKey, string> = {
  [PAYMENT_PROVIDER.BETRA_H2H]: 'Limpay',
  [PAYMENT_PROVIDER.WESTWALLET]: 'Crypto',
};

export function getPaymentProviderDisplayName(provider: PaymentProviderKey): string {
  return paymentProviderDisplayName[provider];
}
