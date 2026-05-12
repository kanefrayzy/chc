'use client';

import { useEffect } from 'react';
import { getRealtimeSocket } from './socket';
import type { MessageDto } from '@/lib/api/tickets';

export interface TicketMessageEvent {
  id: string;
  ticketId: string;
  authorId: string | null;
  kind: MessageDto['kind'];
  body: string;
  createdAt: string;
}

export interface TicketStatusEvent {
  ticketId: string;
  status: 'OPEN' | 'WAITING_USER' | 'WAITING_MODERATOR' | 'CLOSED';
  closedAt: string | null;
}

interface UseTicketSocketHandlers {
  onMessage?: (msg: TicketMessageEvent) => void;
  onStatus?: (s: TicketStatusEvent) => void;
}

export function useTicketSocket(ticketId: string | null, handlers: UseTicketSocketHandlers): void {
  useEffect(() => {
    if (!ticketId) return;
    const socket = getRealtimeSocket();

    const subscribe = (): void => {
      socket.emit('subscribe:ticket', { ticketId });
    };
    if (socket.connected) subscribe();
    socket.on('connect', subscribe);

    const onMsg = (m: TicketMessageEvent): void => {
      if (m.ticketId !== ticketId) return;
      handlers.onMessage?.(m);
    };
    const onStat = (s: TicketStatusEvent): void => {
      if (s.ticketId !== ticketId) return;
      handlers.onStatus?.(s);
    };
    socket.on('ticket:message', onMsg);
    socket.on('ticket:status', onStat);

    return () => {
      socket.emit('unsubscribe:ticket', { ticketId });
      socket.off('connect', subscribe);
      socket.off('ticket:message', onMsg);
      socket.off('ticket:status', onStat);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);
}
