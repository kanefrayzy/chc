'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Spinner, Alert } from '@chcgreen/ui';
import { TicketList } from './TicketList';
import { ChatThread } from './ChatThread';
import { ticketsApi, type TicketDto } from '@/lib/api/tickets';

const POLL_INTERVAL_MS = 8000;

export interface ChatLayoutProps {
  locale: string;
  initialTicketId?: string | null;
}

export function ChatLayout({ locale, initialTicketId }: ChatLayoutProps): JSX.Element {
  const t = useTranslations('chat');
  const [tickets, setTickets] = useState<TicketDto[]>([]);
  const [activeId, setActiveId] = useState<string | null>(initialTicketId ?? null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const pull = async (): Promise<void> => {
      try {
        const res = await ticketsApi.list({ limit: 30 });
        if (cancelled) return;
        setTickets(res.items);
        setErrorMessage(null);
        if (!activeId && res.items[0]) setActiveId(res.items[0].id);
      } catch {
        if (!cancelled) setErrorMessage(t('list.errors.loadFailed'));
      } finally {
        if (!cancelled) {
          setInitialLoading(false);
          timer = setTimeout(pull, POLL_INTERVAL_MS);
        }
      }
    };

    pull();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeTicket = tickets.find((tk) => tk.id === activeId) ?? null;

  if (initialLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }
  if (errorMessage) return <Alert variant="danger">{errorMessage}</Alert>;

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          {t('list.title')}
        </h2>
        <TicketList tickets={tickets} activeId={activeId} onSelect={setActiveId} locale={locale} />
      </aside>
      <section>
        {activeTicket ? (
          <ChatThread ticket={activeTicket} locale={locale} />
        ) : (
          <div className="rounded-xl border border-border p-8 text-center text-sm text-text-secondary">
            {t('thread.selectHint')}
          </div>
        )}
      </section>
    </div>
  );
}
