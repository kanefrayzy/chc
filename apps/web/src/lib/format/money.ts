/**
 * Форматирует знаковую сумму в минорных единицах (qəpik) в строку вида
 * "+12,34 AZN" / "-5,00 AZN".
 */
export interface FormatMoneyOptions {
  /** Показать знак "+" для положительных сумм. По умолчанию true. */
  showPositiveSign?: boolean;
  /** Локаль форматирования (разделитель). */
  locale?: 'ru' | 'az' | 'en';
  /** Показать символ валюты. По умолчанию true. */
  withCurrency?: boolean;
}

const CURRENCY = 'AZN';

export function formatMinorAmount(amountMinor: string, options: FormatMoneyOptions = {}): string {
  const { showPositiveSign = true, locale = 'ru', withCurrency = true } = options;
  const value = BigInt(amountMinor);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const major = abs / 100n;
  const fraction = abs % 100n;
  const fractionStr = fraction.toString().padStart(2, '0');
  const sep = locale === 'en' ? '.' : ',';
  const sign = negative ? '-' : showPositiveSign ? '+' : '';
  const formatted = `${sign}${major}${sep}${fractionStr}`;
  return withCurrency ? `${formatted} ${CURRENCY}` : formatted;
}
