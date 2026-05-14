'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@chcgreen/ui';
import { ArrowRightIcon } from '@/components/icons';
import { useUi } from '@/components/layout/ui-context';

export interface HeroCtaProps {
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
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <Button
          size="lg"
          onClick={() => openAuth('register')}
          rightIcon={<ArrowRightIcon className="h-5 w-5" />}
          className="w-full sm:w-auto sm:min-w-[220px] h-14 text-base font-semibold px-8"
        >
          {t('cta')}
        </Button>
        <Link
          href={registerHref}
          className="inline-flex h-14 w-full sm:w-auto items-center justify-center rounded-lg border border-border bg-bg-elevated px-6 text-base font-semibold text-text-primary transition-colors hover:bg-bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          {t('ctaAlt')}
        </Link>
      </div>
    );
  }

  return (
    <Link
      href={rouletteHref}
      className="inline-flex h-14 w-full sm:w-auto sm:min-w-[220px] items-center justify-center gap-2 rounded-lg bg-brand px-8 text-base font-semibold text-bg-base shadow-glow transition-colors hover:bg-brand-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base"
    >
      {t('ctaPlay')}
      <ArrowRightIcon className="h-5 w-5" />
    </Link>
  );
}
