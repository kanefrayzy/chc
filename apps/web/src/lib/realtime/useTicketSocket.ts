'use client';

import { useEffect, useRef } from 'react';
import { getRealtimeSocket } from './socket';
import type { MessageDto } from '@/lib/api/tickets';

export interface TicketMessageEvent {
  id: string;
  ticketId: string;
  authorId: string | null;
  authorRole?: string | null;
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

export interface UseTicketSocketHandlers {
  onMessage?: (msg: TicketMessageEvent) => void;
  onStatus?: (s: TicketStatusEvent) => void;
  onTyping?: (data: TicketTypingEvent) => void;
}

/**
 * Подписывается на события тикета через WebSocket.
 *
 * Использует `handlersRef`, поэтому колбэки всегда свежие без перезапуска
 * эффекта. Эффект перезапускается только при смене `ticketId`.
 * Переподключение (reconnect) автоматически переподписывается на комнату.
 */
export function useTicketSocket(ticketId: string | null, handlers: UseTicketSocketHandlers): void {
  const handlersRef = useRef<UseTicketSocketHandlers>(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!ticketId) return;
    const socket = getRealtimeSocket();

    const subscribe = (): void => {
      socket.emit('subscribe:ticket', { ticketId });
    };

    // Подписываемся сразу если уже подключены; connect-слушатель ловит reconnect
    if (socket.connected) subscribe();
    socket.on('connect', subscribe);

    const onMsg = (m: TicketMessageEvent): void => {
      if (m.ticketId !== ticketId) return;
      handlersRef.current.onMessage?.(m);
    };
    const onStat = (s: TicketStatusEvent): void => {
      if (s.ticketId !== ticketId) return;
      handlersRef.current.onStatus?.(s);
    };
    const onTyp = (d: TicketTypingEvent): void => {
      if (d.ticketId !== ticketId) return;
      handlersRef.current.onTyping?.(d);
    };

    socket.on('ticket:message', onMsg);
    socket.on('ticket:status', onStat);
    socket.on('ticket:typing', onTyp);

    return () => {
      socket.emit('unsubscribe:ticket', { ticketId });
      socket.off('connect', subscribe);
      socket.off('ticket:message', onMsg);
      socket.off('ticket:status', onStat);
      socket.off('ticket:typing', onTyp);
    };
  }, [ticketId]);
}
