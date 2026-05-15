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
  viewerId: string;
  initialTicketId?: string | null;
}

export function ChatLayout({ locale, viewerId, initialTicketId }: ChatLayoutProps): JSX.Element {
  const t = useTranslations('chat');
  const [tickets, setTickets] = useState<TicketDto[]>([]);
  const [activeId, setActiveId] = useState<string | null>(initialTicketId ?? null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const loadTickets = async (): Promise<TicketDto[]> => {
    const res = await ticketsApi.list({ limit: 30 });
    return res.items;
  };

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const pull = async (): Promise<void> => {
      try {
        const items = await loadTickets();
        if (cancelled) return;
        setTickets(items);
        setErrorMessage(null);
        if (!activeId && items[0]) setActiveId(items[0].id);
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

  const handleNewDialog = async (): Promise<void> => {
    setCreating(true);
    try {
      const ticket = await ticketsApi.create({ subject: 'Поддержка', type: 'SUPPORT' });
      const items = await loadTickets();
      setTickets(items);
      setActiveId(ticket.id);
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

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
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            {t('list.title')}
          </h2>
          <button
            onClick={() => void handleNewDialog()}
            disabled={creating}
            className="rounded-lg bg-brand px-3 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {creating ? '...' : '+ Новый диалог'}
          </button>
        </div>
        <TicketList tickets={tickets} activeId={activeId} onSelect={setActiveId} locale={locale} />
      </aside>
      <section>
        {activeTicket ? (
          <ChatThread ticket={activeTicket} viewerId={viewerId} locale={locale} />
        ) : (
          <div className="rounded-xl border border-border p-8 text-center text-sm text-text-secondary">
            {t('thread.selectHint')}
          </div>
        )}
      </section>
    </div>
  );
}
