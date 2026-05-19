'use client';

import { useEffect } from 'react';
import { getRealtimeSocket } from './socket';
import type { MinesGameDto } from '@/lib/api/mines';

export type MinesStateEvent = MinesGameDto;

/**
 * Подписка на состояние Mines текущего пользователя.
 * Сервер эмитит событие в комнату `user:<id>`, в которую сокет автоматически
 * подключается при аутентификации (см. RealtimeGateway.handleConnection).
 */
export function useMinesSocket(onState: (g: MinesStateEvent) => void): void {
  useEffect(() => {
    const socket = getRealtimeSocket();
    const handler = (g: MinesStateEvent): void => onState(g);
    socket.on('mines:state', handler);
    return () => {
      socket.off('mines:state', handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
