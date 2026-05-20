'use client';

import { useEffect } from 'react';
import { getRealtimeSocket } from './socket';
import type { ClassicRoundDto } from '@/lib/api/classic';

export interface ClassicCompletedEvent {
  roundId: string;
  winnerId: string;
  winnerUsername: string | null;
  winnerAvatarUrl: string | null;
  bankMinor: string;
  payoutMinor: string;
  winningTicket: number | null;
}

export function useClassicSocket(handlers: {
  onRound?: (r: ClassicRoundDto) => void;
  onCompleted?: (e: ClassicCompletedEvent) => void;
}): void {
  useEffect(() => {
    const socket = getRealtimeSocket();
    const onRound = (r: ClassicRoundDto): void => handlers.onRound?.(r);
    const onCompleted = (e: ClassicCompletedEvent): void => handlers.onCompleted?.(e);
    socket.on('classic:round', onRound);
    socket.on('classic:completed', onCompleted);
    return () => {
      socket.off('classic:round', onRound);
      socket.off('classic:completed', onCompleted);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
