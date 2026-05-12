import { getTranslations } from 'next-intl/server';
import { HeroCta } from './HeroCta';

export interface HeroProps {
  locale: string;
  isAuthed: boolean;
}

export async function Hero({ locale, isAuthed }: HeroProps): Promise<JSX.Element> {
  const t = await getTranslations({ locale, namespace: 'hero' });
  const localePrefix = locale === 'ru' ? '' : `/${locale}`;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-bg-card via-bg-card to-bg-card-hover p-6 sm:p-10">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-accent-purple/20 blur-3xl" />
      <div className="relative grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
            ⚡ {t('badge')}
          </span>
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            <span className="block">{t('title1')}</span>
            <span className="block">{t('title2')}</span>
            <span className="block text-brand drop-shadow-[0_0_18px_rgba(0,255,136,0.4)]">
              {t('title3')}
            </span>
          </h1>
          <p className="max-w-md text-text-secondary">{t('subtitle')}</p>
          <HeroCta
            showRegister={!isAuthed}
            registerHref={`${localePrefix}/register`}
            rouletteHref={`${localePrefix}/roulette`}
          />
        </div>
        <div className="relative hidden h-[360px] items-center justify-center lg:flex" aria-hidden>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-72 w-72 rounded-full border border-brand/30 bg-bg-base/70 shadow-[0_0_140px_rgba(0,255,136,0.18)]">
              <div className="m-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)] rounded-full border border-brand/40 bg-gradient-to-tr from-brand/10 to-accent-purple/15">
                <div className="m-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)] animate-[spin_20s_linear_infinite] rounded-full border-2 border-dashed border-brand/40" />
              </div>
            </div>
          </div>
          <div className="absolute right-4 top-6 rounded-xl border border-border bg-bg-card/90 px-3 py-2 text-xs shadow-card backdrop-blur">
            <div className="font-mono text-brand">+1 245.00 AZN</div>
            <div className="text-text-muted">@green_winner</div>
          </div>
          <div className="absolute bottom-8 left-2 rounded-xl border border-border bg-bg-card/90 px-3 py-2 text-xs shadow-card backdrop-blur">
            <div className="font-mono text-brand">×14 GREEN</div>
            <div className="text-text-muted">just now</div>
          </div>
        </div>
      </div>
    </section>
  );
}
