'use client';

import { useEffect } from 'react';
import { getRealtimeSocket } from './socket';
import type { RouletteRoundDto } from '@/lib/api/roulette';

export type RouletteRoundEvent = RouletteRoundDto;

export function useRouletteSocket(onRound: (r: RouletteRoundEvent) => void): void {
  useEffect(() => {
    const socket = getRealtimeSocket();
    const handler = (r: RouletteRoundEvent): void => onRound(r);
    socket.on('roulette:round', handler);
    return () => {
      socket.off('roulette:round', handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
