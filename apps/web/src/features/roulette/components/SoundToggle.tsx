'use client';

import { useEffect, useState } from 'react';
import { isSoundEnabled, setSoundEnabled } from '@/lib/sound';

export function SoundToggle(): JSX.Element {
  const [on, setOn] = useState(true);
  useEffect(() => { setOn(isSoundEnabled()); }, []);
  return (
    <button
      type="button"
      onClick={() => { const v = !on; setOn(v); setSoundEnabled(v); }}
      title={on ? 'Звук включён' : 'Звук выключен'}
      className="flex items-center gap-1 rounded-md border border-border bg-bg-elevated px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary"
    >
      <span>{on ? '🔊' : '🔇'}</span>
    </button>
  );
}
