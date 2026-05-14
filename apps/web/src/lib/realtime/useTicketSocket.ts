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

export interface TicketTypingEvent {
  ticketId: string;
  userId: string;
  isTyping: boolean;
}

interface UseTicketSocketHandlers {
  onMessage?: (msg: TicketMessageEvent) => void;
  onStatus?: (s: TicketStatusEvent) => void;
  onTyping?: (data: TicketTypingEvent) => void;
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
    const onTyping = (data: TicketTypingEvent): void => {
      if (data.ticketId !== ticketId) return;
      handlers.onTyping?.(data);
    };
    socket.on('ticket:message', onMsg);
    socket.on('ticket:status', onStat);
    socket.on('ticket:typing', onTyping);

    return () => {
      socket.emit('unsubscribe:ticket', { ticketId });
      socket.off('connect', subscribe);
      socket.off('ticket:message', onMsg);
      socket.off('ticket:status', onStat);
      socket.off('ticket:typing', onTyping);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);
}
