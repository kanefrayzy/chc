import { defaultLocale } from '@/i18n/request';

/**
 * Префикс локали для ссылок. Язык по умолчанию живёт без префикса
 * (`localePrefix: 'as-needed'` в middleware), остальные — с ним.
 *
 * Всегда используйте этот хелпер вместо сравнения с конкретным языком:
 * иначе смена языка по умолчанию тихо ломает половину ссылок на сайте.
 */
export function localePrefix(locale: string): string {
  return locale === defaultLocale ? '' : `/${locale}`;
}
