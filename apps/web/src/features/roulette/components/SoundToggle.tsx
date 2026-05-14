'use client';

import { useEffect, useState } from 'react';
import { isSoundEnabled, setSoundEnabled } from '@/lib/sound';
import { VolumeIcon, VolumeMutedIcon } from '@/components/icons';

export function SoundToggle(): JSX.Element {
  const [on, setOn] = useState(true);
  useEffect(() => { setOn(isSoundEnabled()); }, []);
  return (
    <button
      type="button"
      onClick={() => { const v = !on; setOn(v); setSoundEnabled(v); }}
      title={on ? 'Звук включён' : 'Звук выключен'}
      aria-pressed={on}
      aria-label={on ? 'Выключить звук' : 'Включить звук'}
      className="flex h-8 items-center justify-center gap-1 rounded-md border border-border bg-bg-elevated px-2 text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
    >
      {on ? <VolumeIcon className="h-4 w-4" /> : <VolumeMutedIcon className="h-4 w-4" />}
    </button>
  );
}
