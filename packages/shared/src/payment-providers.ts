/**
 * Платёжные провайдеры.
 *
 * `betatransfer` — фиатный шлюз (https://docs.betatransfer.io), см. ADR-0007.
 * `westwallet` — криптовалютный шлюз.
 */

export const PAYMENT_PROVIDER = {
  BETATRANSFER: 'betatransfer',
  WESTWALLET: 'westwallet',
} as const;

export type PaymentProviderKey = (typeof PAYMENT_PROVIDER)[keyof typeof PAYMENT_PROVIDER];

/** Отображаемое имя провайдера для пользователя. */
export const paymentProviderDisplayName: Record<PaymentProviderKey, string> = {
  [PAYMENT_PROVIDER.BETATRANSFER]: 'Betatransfer',
  [PAYMENT_PROVIDER.WESTWALLET]: 'Crypto',
};

export function getPaymentProviderDisplayName(provider: PaymentProviderKey): string {
  return paymentProviderDisplayName[provider];
}
