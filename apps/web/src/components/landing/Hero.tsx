import { getTranslations } from 'next-intl/server';
import { BoltIcon } from '@/components/icons';
import { getPublicSettings } from '@/lib/api/settings';
import { HeroCta } from './HeroCta';
import { localePrefix } from '@/lib/i18n/prefix';

export interface HeroProps {
  locale: string;
  isAuthed: boolean;
}

export async function Hero({ locale, isAuthed }: HeroProps): Promise<JSX.Element> {
  const t = await getTranslations({ locale, namespace: 'hero' });
  const settings = await getPublicSettings();
  const heroImageUrl = settings['brand.hero_image_url'] || '';
  const prefix = localePrefix(locale);

  return (
    <section aria-labelledby="hero-title" className="relative py-2 sm:py-4 lg:py-0">
      {/*
        Баннер нарисован с пустым левым краем — он и предназначен под заголовок.
        На десктопе картинка уходит фоном вправо, текст ложится поверх пустоты;
        на телефоне места для этого нет, поэтому она остаётся над текстом.
      */}
      {heroImageUrl && (
        <div
          aria-hidden
          className="pointer-events-none mb-4 lg:absolute lg:inset-y-0 lg:right-0 lg:mb-0 lg:w-[72%]"
        >
          <div className="relative h-40 w-full sm:h-56 lg:h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroImageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-contain object-center drop-shadow-[0_30px_80px_rgba(0,255,136,0.25)] lg:object-right"
            />
          </div>
        </div>
      )}

      <div className="relative">
        <div className="max-w-xl space-y-5 sm:space-y-6 lg:flex lg:min-h-[26rem] lg:max-w-[48%] lg:flex-col lg:justify-center">
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
            registerHref={`${prefix}/register`}
            rouletteHref={`${prefix}/roulette`}
          />
        </div>

        {/* Картинки нет — рисуем декоративный круг, чтобы блок не пустовал */}
        {!heroImageUrl && (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 hidden w-[55%] items-center justify-center md:flex"
            aria-hidden
          >
            <div className="h-64 w-64 rounded-full border border-brand/30 bg-bg-base/70 shadow-[0_0_140px_rgba(0,255,136,0.18)] lg:h-80 lg:w-80">
              <div className="m-3 h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] rounded-full border border-brand/40 bg-gradient-to-tr from-brand/10 to-accent-purple/15">
                <div className="m-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)] animate-[spin_24s_linear_infinite] rounded-full border-2 border-dashed border-brand/40">
                  <div className="m-6 h-[calc(100%-3rem)] w-[calc(100%-3rem)] rounded-full bg-gradient-to-br from-bg-card to-bg-base shadow-inner" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
