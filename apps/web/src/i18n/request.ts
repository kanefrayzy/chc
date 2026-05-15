import { getRequestConfig } from 'next-intl/server';
import type { AbstractIntlMessages } from 'next-intl';

export const locales = ['ru', 'az'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'ru';

async function loadMessages(locale: Locale): Promise<AbstractIntlMessages> {
  // Try to load custom translations from API (DB override).
  // Falls back to bundled static file if not set or on network error.
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    const res = await fetch(`${apiBase}/translations/${locale}`, { cache: 'no-store' });
    if (res.ok) {
      return (await res.json()) as AbstractIntlMessages;
    }
  } catch {
    // network error — fall through to static import
  }
  return (await import(`./messages/${locale}.json`)).default as AbstractIntlMessages;
}

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
