import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { GiftIcon, ArrowRightIcon } from '@/components/icons';

export interface FirstDepositPromoProps {
  locale: string;
  isAuthed: boolean;
}

export async function FirstDepositPromo({
  locale,
  isAuthed,
}: FirstDepositPromoProps): Promise<JSX.Element> {
  const t = await getTranslations({ locale, namespace: 'promo' });
  const localePrefix = locale === 'ru' ? '' : `/${locale}`;
  const href = isAuthed ? `${localePrefix}/deposit` : `${localePrefix}/register`;

  return (
    <Link
      href={href}
      className="group relative col-span-2 overflow-hidden rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/15 via-bg-card to-accent-purple/15 p-4 transition-all hover:border-brand/50 hover:shadow-glow lg:col-span-1 sm:p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      aria-label={t('title')}
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-brand/20 blur-3xl" />
      <div className="relative flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand ring-1 ring-brand/30">
          <GiftIcon className="h-7 w-7" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
            {t('title')}
          </div>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className="font-mono text-2xl font-extrabold text-brand drop-shadow-[0_0_8px_rgba(0,255,136,0.4)]">
              +100%
            </span>
          </div>
          <div className="mt-0.5 text-xs text-text-secondary">{t('subtitle')}</div>
        </div>
        <ArrowRightIcon className="hidden h-4 w-4 text-brand transition-transform group-hover:translate-x-1 sm:block" />
      </div>
    </Link>
  );
}
