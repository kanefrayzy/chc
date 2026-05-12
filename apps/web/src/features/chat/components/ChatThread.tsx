'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardBody, CardHeader, Spinner, Badge } from '@chcgreen/ui';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { ticketsApi, type MessageDto, type TicketDto } from '@/lib/api/tickets';

const POLL_INTERVAL_MS = 4000;

export interface ChatThreadProps {
  ticket: TicketDto;
  locale: string;
}

export function ChatThread({ ticket, locale }: ChatThreadProps): JSX.Element {
  const t = useTranslations('chat');
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const pull = async (): Promise<void> => {
      try {
        const res = await ticketsApi.messages(ticket.id, { limit: 100 });
        if (cancelled) return;
        setMessages(res.items);
        lastIdRef.current = res.items[res.items.length - 1]?.id ?? null;
      } catch {
        /* silent */
      } finally {
        if (!cancelled) {
          setInitialLoading(false);
          timer = setTimeout(pull, POLL_INTERVAL_MS);
        }
      }
    };

    setInitialLoading(true);
    setMessages([]);
    lastIdRef.current = null;
    pull();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [ticket.id]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

  const handleSend = async (body: string): Promise<void> => {
    const msg = await ticketsApi.sendMessage(ticket.id, body);
    setMessages((prev) => [...prev, msg]);
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
        <Badge variant="info">{t(`status.${ticket.status}`)}</Badge>
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
      <MessageComposer onSend={handleSend} disabled={ticket.status === 'CLOSED'} />
    </Card>
  );
}
