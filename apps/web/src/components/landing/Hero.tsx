import { useTranslations } from 'next-intl';
import { Button } from '@chcgreen/ui';
import Link from 'next/link';

export interface HeroProps {
  locale: string;
}

export function Hero({ locale }: HeroProps): JSX.Element {
  const t = useTranslations('hero');
  const localePrefix = locale === 'ru' ? '' : `/${locale}`;

  return (
    <section className="mt-10 grid grid-cols-1 items-center gap-6 overflow-hidden rounded-xl border border-border bg-gradient-to-br from-bg-card to-bg-card-hover p-5 lg:grid-cols-2 lg:p-8">
      <div className="space-y-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
          ⚡ {t('badge')}
        </span>
        <h1 className="text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl">
          <span className="block">{t('title1')}</span>
          <span className="block">{t('title2')}</span>
          <span className="block text-brand drop-shadow-[0_0_18px_rgba(0,255,136,0.4)]">
            {t('title3')}
          </span>
        </h1>
        <p className="max-w-md text-text-secondary">{t('subtitle')}</p>
        <Link href={`${localePrefix}/register`}>
          <Button size="lg" rightIcon={<span aria-hidden>→</span>}>
            {t('cta')}
          </Button>
        </Link>
      </div>
      <div className="hidden h-[360px] items-center justify-center lg:flex" aria-hidden>
        <div className="relative h-72 w-72 rounded-full border border-brand/20 bg-bg-base shadow-[0_0_120px_rgba(0,255,136,0.15)]">
          <div className="absolute inset-6 rounded-full border border-brand/30" />
          <div className="absolute inset-12 rounded-full border-2 border-dashed border-brand/30" />
        </div>
      </div>
    </section>
  );
}
