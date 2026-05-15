import { getRequestConfig } from 'next-intl/server';

export const locales = ['ru', 'az'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'ru';

async function loadMessages(locale: Locale): Promise<Record<string, unknown>> {
  // Try to load custom translations from API (DB override).
  // Falls back to bundled static file if not set or on network error.
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    const res = await fetch(`${apiBase}/translations/${locale}`, {
      next: { revalidate: 60 }, // ISR: refresh every 60s
      cache: 'force-cache',
    });
    if (res.ok) {
      return (await res.json()) as Record<string, unknown>;
    }
  } catch {
    // network error — fall through to static import
  }
  return (await import(`./messages/${locale}.json`)).default as Record<string, unknown>;
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
