'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardBody, CardHeader, Spinner, Badge } from '@chcgreen/ui';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { ticketsApi, type MessageDto, type TicketDto } from '@/lib/api/tickets';
import { useTicketSocket } from '@/lib/realtime/useTicketSocket';
import { getRealtimeSocket } from '@/lib/realtime/socket';
import { playMessageSound } from '@/lib/sounds';

export interface ChatThreadProps {
  ticket: TicketDto;
  /** id текущего пользователя — нужен чтобы расставлять `isMine` для приходящих сокет-событий */
  viewerId: string;
  locale: string;
}

export function ChatThread({ ticket, viewerId, locale }: ChatThreadProps): JSX.Element {
  const t = useTranslations('chat');
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [status, setStatus] = useState(ticket.status);
  const [isTyping, setIsTyping] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [oldestId, setOldestId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Первичная загрузка — последние 30 сообщений
  useEffect(() => {
    let cancelled = false;
    setInitialLoading(true);
    setMessages([]);
    setStatus(ticket.status);
    setHasMore(false);
    setOldestId(null);
    (async () => {
      try {
        const res = await ticketsApi.messages(ticket.id, { limit: 30 });
        if (!cancelled) {
          setMessages(res.items);
          setHasMore(res.items.length >= 30);
          setOldestId(res.items[0]?.id ?? null);
        }
      } catch {
        /* silent */
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [ticket.id, ticket.status]);

  // Load more
  const loadMore = useCallback(async () => {
    if (!oldestId || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await ticketsApi.messages(ticket.id, { limit: 30, beforeId: oldestId });
      if (res.items.length === 0 || res.items.length < 30) setHasMore(false);
      const first = res.items[0];
      if (first) {
        setOldestId(first.id);
        const list = scrollRef.current;
        const prevHeight = list?.scrollHeight ?? 0;
        setMessages((m) => [...res.items.filter(p => !m.some(x => x.id === p.id)), ...m]);
        requestAnimationFrame(() => {
          if (list) list.scrollTop = list.scrollHeight - prevHeight;
        });
      }
    } finally {
      setLoadingMore(false);
    }
  }, [ticket.id, oldestId, loadingMore]);

  // Realtime подписка
  useTicketSocket(ticket.id, {
    onMessage: (m) => {
      const dto: MessageDto = {
        id: m.id,
        ticketId: m.ticketId,
        authorId: m.authorId,
        kind: m.kind,
        body: m.body,
        createdAt: m.createdAt,
        isMine: m.authorId === viewerId,
      };
      setMessages((prev) => (prev.some((x) => x.id === dto.id) ? prev : [...prev, dto]));
      // Звук только для входящих
      if (m.authorId !== viewerId) {
        playMessageSound();
        setIsTyping(false); // печатание прекратилось
      }
    },
    onStatus: (s) => {
      setStatus(s.status);
    },
    onTyping: (data) => {
      if (data.userId === viewerId) return;
      setIsTyping(data.isTyping);
      if (data.isTyping) {
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setIsTyping(false), 4000);
      }
    },
  });

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length]);

  useEffect(() => () => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
  }, []);

  const [sendError, setSendError] = useState<string | null>(null);

  const handleTypingChange = useCallback((isTyping: boolean) => {
    try {
      const socket = getRealtimeSocket();
      socket.emit('typing:ticket', { ticketId: ticket.id, isTyping });
    } catch { /* silent */ }
  }, [ticket.id]);

  const handleSend = async (body: string): Promise<void> => {
    setSendError(null);
    try {
      const msg = await ticketsApi.sendMessage(ticket.id, body);
      setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Ошибка отправки';
      if (text.includes('TICKET_CLOSED') || text.includes('CLOSED')) {
        setStatus('CLOSED');
        setSendError(t('errors.ticketClosed'));
      } else {
        setSendError(text);
      }
    }
  };

  return (
    <Card variant="elevated" padding="none" className="flex h-[600px] flex-col">
      <CardHeader className="flex items-center justify-between border-b border-border">
        <div>
          <div className="text-sm text-text-muted">{t(`type.${ticket.type}`)}</div>
          <div className="text-lg font-semibold text-text-primary">
            {ticket.subject ?? t(`type.${ticket.type}`)}
          </div>
        </div>
        <Badge variant="info">{t(`status.${status}`)}</Badge>
      </CardHeader>
      <CardBody className="flex-1 overflow-hidden p-0">
        <div ref={scrollRef} className="h-full space-y-2 overflow-y-auto px-4 py-3">
          {hasMore && (
            <div className="text-center py-1">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="text-xs text-primary hover:underline disabled:opacity-50"
              >
                {loadingMore ? '...' : t('thread.loadMore', { defaultMessage: 'Загрузить ещё' })}
              </button>
            </div>
          )}
          {initialLoading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-text-secondary">
              {t('thread.empty')}
            </div>
          ) : (
            messages.map((m) => <MessageBubble key={m.id} message={m} locale={locale} />)
          )}
          {isTyping && (
            <div className="flex gap-1.5 items-center text-xs text-text-muted italic px-1">
              <span className="flex gap-0.5">
                <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:300ms]" />
              </span>
              {t('thread.typing', { defaultMessage: 'Поддержка печатает...' })}
            </div>
          )}
        </div>
      </CardBody>
      {sendError && (
        <div className="px-3 pb-1 text-xs text-danger">{sendError}</div>
      )}
      <MessageComposer onSend={handleSend} disabled={status === 'CLOSED'} onTypingChange={handleTypingChange} />
    </Card>
  );
}
