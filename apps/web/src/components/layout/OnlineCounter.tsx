'use client';

import { useState, useEffect } from 'react';
import { getRealtimeSocket } from '@/lib/realtime/socket';

/** Базовое смещение, если в настройках ничего не задано. */
const DEFAULT_BASE = 120;

export interface OnlineCounterProps {
  /** Настройка `online.base_count`: онлайн = база + реальные WS-клиенты. */
  base?: number;
}

export function OnlineCounter({ base = DEFAULT_BASE }: OnlineCounterProps): JSX.Element {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const socket = getRealtimeSocket();

    const onCount = (data: { count: number }) => {
      setCount(base + Math.max(0, data.count));
    };

    socket.on('online:count', onCount);

    // Запрашиваем начальное значение — сервер ответит через 'online:count'
    if (socket.connected) {
      socket.emit('get:online');
    } else {
      socket.once('connect', () => socket.emit('get:online'));
    }

    return () => {
      socket.off('online:count', onCount);
    };
  }, [base]);

  if (count === null) return <></>;

  return (
    <span className="flex items-center gap-1.5 text-xs text-text-secondary select-none">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
      </span>
      <span>{count} онлайн</span>
    </span>
  );
}
