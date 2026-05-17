'use client';

import { useState, useEffect } from 'react';
import { getRealtimeSocket } from '@/lib/realtime/socket';

/** Базовое смещение: онлайн = 50 + реальное число WS-клиентов */
const BASE_OFFSET = 50;

export function OnlineCounter(): JSX.Element {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const socket = getRealtimeSocket();

    const onCount = (data: { count: number }) => {
      setCount(BASE_OFFSET + Math.max(0, data.count));
    };

    socket.on('online:count', onCount);

    // Запрашиваем начальное значение при монтировании
    socket.emit('get:online', {}, (res: { count?: number } | undefined) => {
      if (res && typeof res.count === 'number') {
        setCount(BASE_OFFSET + Math.max(0, res.count));
      }
    });

    return () => {
      socket.off('online:count', onCount);
    };
  }, []);

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
