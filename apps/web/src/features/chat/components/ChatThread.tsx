'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardBody, CardHeader, Spinner, Badge } from '@chcgreen/ui';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { ticketsApi, type MessageDto, type TicketDto } from '@/lib/api/tickets';
import { useTicketSocket } from '@/lib/realtime/useTicketSocket';

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
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Первичная загрузка
  useEffect(() => {
    let cancelled = false;
    setInitialLoading(true);
    setMessages([]);
    setStatus(ticket.status);
    (async () => {
      try {
        const res = await ticketsApi.messages(ticket.id, { limit: 100 });
        if (!cancelled) setMessages(res.items);
      } catch {
        /* silent */
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticket.id, ticket.status]);

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
    },
    onStatus: (s) => {
      setStatus(s.status);
    },
  });

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

  const handleSend = async (body: string): Promise<void> => {
    const msg = await ticketsApi.sendMessage(ticket.id, body);
    setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));
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
        </div>
      </CardBody>
      <MessageComposer onSend={handleSend} disabled={status === 'CLOSED'} />
    </Card>
  );
}
