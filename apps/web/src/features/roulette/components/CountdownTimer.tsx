'use client';

import { useEffect, useRef, useState } from 'react';
import { playCountdownTick, playCountdownSoftTick } from '@/lib/sound';

export interface CountdownTimerProps {
  /** Дата/время-метка окончания приёма ставок (ISO). */
  endsAt: string;
  /** Колбэк при достижении нуля (один раз). */
  onEnd?: () => void;
}

export function CountdownTimer({ endsAt, onEnd }: CountdownTimerProps): JSX.Element {
  const [now, setNow] = useState(() => Date.now());
  const prevSecondsRef = useRef<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const target = new Date(endsAt).getTime();
  const remainingMs = Math.max(0, target - now);
  const seconds = Math.ceil(remainingMs / 1000);

  // Звук обратного отсчёта — один раз при смене значения
  useEffect(() => {
    if (seconds > 0 && prevSecondsRef.current !== seconds) {
      if (seconds <= 3) {
        playCountdownTick();
      } else {
        playCountdownSoftTick();
      }
    }
    prevSecondsRef.current = seconds;
  }, [seconds]);

  useEffect(() => {
    if (remainingMs === 0 && onEnd) onEnd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs === 0]);

  return (
    <span className={`tabular-nums${seconds <= 3 && seconds > 0 ? ' text-danger font-bold' : ''}`}>
      {seconds}s
    </span>
  );
}
