'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@chcgreen/ui';
import { useUi } from '@/components/layout/ui-context';

export interface HeroCtaProps {
  /** показывать ли «Регистрация» (если гость) */
  showRegister: boolean;
  registerHref: string;
  rouletteHref: string;
}

export function HeroCta({
  showRegister,
  registerHref,
  rouletteHref,
}: HeroCtaProps): JSX.Element {
  const t = useTranslations('hero');
  const { openAuth } = useUi();

  if (showRegister) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={() => openAuth('register')} rightIcon={<span aria-hidden>→</span>}>
          {t('cta')}
        </Button>
        <a
          href={registerHref}
          className="text-sm font-medium text-text-secondary underline-offset-4 hover:text-text-primary hover:underline"
        >
          {t('ctaAlt')}
        </a>
      </div>
    );
  }

  return (
    <a
      href={rouletteHref}
      className="inline-flex h-13 items-center gap-2 rounded-lg bg-brand px-7 text-base font-semibold text-bg-base shadow-glow hover:bg-brand-dim"
    >
      {t('ctaPlay')} <span aria-hidden>→</span>
    </a>
  );
}
