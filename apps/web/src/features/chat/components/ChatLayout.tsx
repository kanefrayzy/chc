'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Spinner, Alert } from '@chcgreen/ui';
import { ChatThread } from './ChatThread';
import { ticketsApi, type TicketDto } from '@/lib/api/tickets';

export interface ChatLayoutProps {
  locale: string;
  viewerId: string;
  initialTicketId?: string | null;
}

export function ChatLayout({ locale, viewerId, initialTicketId }: ChatLayoutProps): JSX.Element {
  const t = useTranslations('chat');
  const [ticket, setTicket] = useState<TicketDto | null>(null);
  const [activeId, setActiveId] = useState<string | null>(initialTicketId ?? null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setInitialLoading(true);

    (async () => {
      try {
        const res = await ticketsApi.list({ limit: 30 });
        if (cancelled) return;

        const supportTicket =
          res.items.find((tk) => tk.type === 'SUPPORT') ?? res.items[0] ?? null;

        if (supportTicket) {
          setTicket(supportTicket);
          setActiveId(supportTicket.id);
        } else {
          // Нет тикетов — создаём единственный автоматически
          const created = await ticketsApi.create({ subject: 'Поддержка', type: 'SUPPORT' });
          if (!cancelled) {
            setTicket(created);
            setActiveId(created.id);
          }
        }
        setErrorMessage(null);
      } catch {
        if (!cancelled) setErrorMessage(t('list.errors.loadFailed'));
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (initialLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }
  if (errorMessage) return <Alert variant="danger">{errorMessage}</Alert>;

  return (
    <div className="w-full">
      {ticket ? (
        <ChatThread ticket={ticket} viewerId={viewerId} locale={locale} />
      ) : (
        <div className="rounded-xl border border-border p-8 text-center text-sm text-text-secondary">
          {t('thread.selectHint')}
        </div>
      )}
    </div>
  );
}

