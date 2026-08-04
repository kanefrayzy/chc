import { getRequestConfig } from 'next-intl/server';
import type { AbstractIntlMessages } from 'next-intl';
import { memoTtlBy } from '@/lib/api/memo';

export const locales = ['az', 'ru'] as const;
export type Locale = (typeof locales)[number];
/**
 * Основной язык сайта. Живёт без префикса в URL, остальные — с префиксом.
 * Ссылки собирайте через `localePrefix()` из `@/lib/i18n/prefix`, иначе
 * смена этого значения тихо ломает навигацию.
 */
export const defaultLocale: Locale = 'az';

type Dict = Record<string, unknown>;

/**
 * Накладывает override на base. Побеждает override, но только там, где у него
 * есть значение: ключи, которых в нём нет, остаются из base.
 */
function deepMerge(base: Dict, override: Dict): Dict {
  const result: Dict = { ...base };
  for (const key of Object.keys(override)) {
    const bv = base[key];
    const ov = override[key];
    const bothObjects =
      ov !== null &&
      typeof ov === 'object' &&
      !Array.isArray(ov) &&
      bv !== null &&
      typeof bv === 'object' &&
      !Array.isArray(bv);
    result[key] = bothObjects ? deepMerge(bv as Dict, ov as Dict) : ov;
  }
  return result;
}

/** Внутренний адрес API: конфиг грузится только на сервере. */
function apiBaseUrl(): string {
  return (
    process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://api:4000'
  );
}

/**
 * Базой всегда служит встроенный файл, а ответ API (правки из админки) идёт
 * поверх него. Иначе устаревший словарь из API затирает новые ключи целиком —
 * и вместо текста на странице появляются сами ключи вида `lottery.buy`.
 */
async function fetchMessages(locale: Locale): Promise<AbstractIntlMessages> {
  const bundled = ((await import(`./messages/${locale}.json`)).default ?? {}) as Dict;
  try {
    const res = await fetch(`${apiBaseUrl()}/translations/${locale}`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const override = (await res.json()) as Dict;
      if (override && typeof override === 'object') {
        return deepMerge(bundled, override) as AbstractIntlMessages;
      }
    }
  } catch {
    // API недоступен — работаем на встроенном словаре
  }
  return bundled as AbstractIntlMessages;
}

/**
 * Словарь нужен каждому рендеру, а меняется он только правками в админке,
 * которые и так применяются с минутной задержкой. Без этого кэша сайт тянул
 * из API все 556 ключей на каждый заход посетителя.
 */
const loadMessages = memoTtlBy<Locale, AbstractIntlMessages>(fetchMessages, 60_000);

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !locales.includes(locale as Locale)) {
    locale = defaultLocale;
  }
  return {
    locale,
    messages: await loadMessages(locale as Locale),
  };
});
