'use client';

import { useEffect, useState } from 'react';

export interface CountdownTimerProps {
  /** Дата/время-метка окончания приёма ставок (ISO). */
  endsAt: string;
  /** Колбэк при достижении нуля (один раз). */
  onEnd?: () => void;
}

export function CountdownTimer({ endsAt, onEnd }: CountdownTimerProps): JSX.Element {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const target = new Date(endsAt).getTime();
  const remainingMs = Math.max(0, target - now);
  const seconds = Math.ceil(remainingMs / 1000);

  useEffect(() => {
    if (remainingMs === 0 && onEnd) onEnd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs === 0]);

  return <span className="tabular-nums">{seconds}s</span>;
}
