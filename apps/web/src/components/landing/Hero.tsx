import { getTranslations } from 'next-intl/server';
import { BoltIcon } from '@/components/icons';
import { getPublicSettings } from '@/lib/api/settings';
import { HeroCta } from './HeroCta';

export interface HeroProps {
  locale: string;
  isAuthed: boolean;
}

export async function Hero({ locale, isAuthed }: HeroProps): Promise<JSX.Element> {
  const t = await getTranslations({ locale, namespace: 'hero' });
  const settings = await getPublicSettings();
  const heroImageUrl = settings['brand.hero_image_url'] || '';
  const localePrefix = locale === 'ru' ? '' : `/${locale}`;

  return (
    <section
      aria-labelledby="hero-title"
      className="relative p-6 sm:p-8 lg:p-1"
    >
      {/* <div className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-brand/20 blur-3xl" /> */}

      <div className="relative grid grid-cols-1 items-center gap-8 lg:grid-cols-[1fr_1.6fr]">
        <div className="space-y-5 sm:space-y-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand">
            <BoltIcon className="h-3.5 w-3.5" />
            {t('badge')}
          </span>
          <h1
            id="hero-title"
            className="font-display uppercase text-4xl leading-[1.02] sm:text-5xl lg:text-[3.5rem]"
          >
            <span className="block">{t('title1')}</span>
            <span className="block">{t('title2')}</span>
            <span className="block text-brand drop-shadow-[0_0_18px_rgba(0,255,136,0.4)]">
              {t('title3')}
            </span>
          </h1>
          <p className="max-w-md text-sm text-text-secondary sm:text-base">{t('subtitle')}</p>
          <HeroCta
            showRegister={!isAuthed}
            registerHref={`${localePrefix}/register`}
            rouletteHref={`${localePrefix}/roulette`}
          />
        </div>

        {heroImageUrl ? (
          <div className="relative hidden md:block" aria-hidden>
            <div className="relative aspect-[16/9] w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroImageUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_30px_80px_rgba(0,255,136,0.25)]"
              />
            </div>
          </div>
        ) : (
          <div
            className="relative hidden h-[320px] items-center justify-center md:flex lg:h-[380px]"
            aria-hidden
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-64 w-64 lg:h-80 lg:w-80 rounded-full border border-brand/30 bg-bg-base/70 shadow-[0_0_140px_rgba(0,255,136,0.18)]">
                <div className="m-3 h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] rounded-full border border-brand/40 bg-gradient-to-tr from-brand/10 to-accent-purple/15">
                  <div className="m-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)] animate-[spin_24s_linear_infinite] rounded-full border-2 border-dashed border-brand/40">
                    <div className="m-6 h-[calc(100%-3rem)] w-[calc(100%-3rem)] rounded-full bg-gradient-to-br from-bg-card to-bg-base shadow-inner" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
