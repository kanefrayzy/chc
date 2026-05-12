/**
 * Money utilities.
 *
 * Все суммы в системе хранятся в МИНОРНЫХ ЕДИНИЦАХ (qəpik) как `bigint`.
 * 1 AZN = 100 qəpik. См. docs/decisions.md ADR-0003.
 *
 * Эти функции — единственный официальный способ конвертировать деньги между:
 *   - bigint (внутренний формат, БД)
 *   - string (сериализация в JSON, ввод пользователя)
 *   - отображаемый формат "123,45 AZN"
 */

export const CURRENCY = 'AZN' as const;
export const MINOR_PER_MAJOR = 100n; // 1 AZN = 100 qəpik

export type MoneyMinor = bigint;

/** Парсит пользовательский ввод вида "12.34" / "12,34" / "12" в qəpik. */
export function parseMajorToMinor(input: string): MoneyMinor {
  const normalized = input.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`Invalid money format: "${input}"`);
  }
  const [major, fraction = ''] = normalized.split('.');
  const paddedFraction = (fraction + '00').slice(0, 2);
  return BigInt(major!) * MINOR_PER_MAJOR + BigInt(paddedFraction);
}

/** Возвращает строку вида "12.34" (без символа валюты). */
export function formatMinorToMajor(minor: MoneyMinor): string {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const major = abs / MINOR_PER_MAJOR;
  const fraction = abs % MINOR_PER_MAJOR;
  const fractionStr = fraction.toString().padStart(2, '0');
  return `${negative ? '-' : ''}${major}.${fractionStr}`;
}

/** Возвращает локализованную строку вида "12,34 AZN" / "₼ 12.34". */
export function formatMoney(
  minor: MoneyMinor,
  options: { locale?: 'ru' | 'az' | 'en'; withCurrency?: boolean } = {},
): string {
  const { locale = 'ru', withCurrency = true } = options;
  const major = formatMinorToMajor(minor);
  const localized = locale === 'en' ? major : major.replace('.', ',');
  return withCurrency ? `${localized} ${CURRENCY}` : localized;
}

/** Безопасная сериализация bigint в JSON (для API-ответов). */
export function minorToJson(minor: MoneyMinor): string {
  return minor.toString();
}

/** Парсинг bigint из JSON. */
export function minorFromJson(value: string | number): MoneyMinor {
  return BigInt(value);
}
