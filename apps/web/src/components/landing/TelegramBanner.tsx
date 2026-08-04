import { getTranslations } from 'next-intl/server';
import { TelegramIcon } from '@/components/icons';

export interface TelegramBannerProps {
  /** Ссылка на группу из настроек (brand.social_telegram). Пусто — блок не выводится. */
  href: string;
  /** Подпись из настроек (brand.social_telegram_label). Пусто — берём перевод. */
  label?: string;
  locale: string;
}

/**
 * Баннер-приглашение в Telegram-группу. Ссылка и подпись задаются
 * в админке (Настройки → brand.social_telegram / brand.social_telegram_label).
 */
export async function TelegramBanner({
  href,
  label,
  locale,
}: TelegramBannerProps): Promise<JSX.Element | null> {
  if (!href) return null;
  const t = await getTranslations({ locale, namespace: 'telegram' });

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative mt-8 block overflow-hidden rounded-2xl border border-[#229ED9]/30 bg-gradient-to-r from-[#229ED9]/15 via-[#229ED9]/[0.06] to-transparent p-5 transition-all hover:border-[#229ED9]/60 hover:shadow-[0_0_40px_rgba(34,158,217,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#229ED9]/50 sm:p-6"
    >
      {/* Декоративное свечение */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#229ED9]/20 blur-3xl transition-opacity group-hover:opacity-150"
      />

      <div className="relative flex items-center gap-4">
        <span
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#229ED9] text-white shadow-[0_6px_20px_rgba(34,158,217,0.35)] sm:h-14 sm:w-14"
        >
          <TelegramIcon className="h-6 w-6 sm:h-7 sm:w-7" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-text-primary sm:text-lg">
            {t('title')}
          </p>
          <p className="mt-0.5 text-xs text-text-secondary sm:text-sm">
            {label || t('text')}
          </p>
        </div>

        <span className="hidden shrink-0 items-center gap-1.5 rounded-xl bg-[#229ED9] px-4 py-2.5 text-sm font-semibold text-white transition-transform group-hover:translate-x-0.5 sm:inline-flex">
          {t('join')}
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
            <path
              d="M4 8h8m-3.5-3.5L12 8l-3.5 3.5"
              stroke="currentColor"
              strokeWidth="1.8"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>

        <span
          aria-hidden
          className="shrink-0 text-[#229ED9] transition-transform group-hover:translate-x-0.5 sm:hidden"
        >
          <svg viewBox="0 0 16 16" className="h-5 w-5">
            <path
              d="M6 3.5L10.5 8 6 12.5"
              stroke="currentColor"
              strokeWidth="1.8"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </a>
  );
}
