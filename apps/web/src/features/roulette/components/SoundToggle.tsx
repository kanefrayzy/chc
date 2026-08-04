'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { isSoundEnabled, setSoundEnabled } from '@/lib/sound';
import { VolumeIcon, VolumeMutedIcon } from '@/components/icons';

export function SoundToggle(): JSX.Element {
  const t = useTranslations('roulette');
  const [on, setOn] = useState(true);
  useEffect(() => { setOn(isSoundEnabled()); }, []);
  return (
    <button
      type="button"
      onClick={() => { const v = !on; setOn(v); setSoundEnabled(v); }}
      title={on ? t('sound.on') : t('sound.off')}
      aria-pressed={on}
      aria-label={on ? t('sound.disable') : t('sound.enable')}
      className="flex h-8 items-center justify-center gap-1 rounded-md border border-border bg-bg-elevated px-2 text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
    >
      {on ? <VolumeIcon className="h-4 w-4" /> : <VolumeMutedIcon className="h-4 w-4" />}
    </button>
  );
}
