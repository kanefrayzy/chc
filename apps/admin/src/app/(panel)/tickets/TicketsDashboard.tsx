'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { AdminTicketRow, AdminMessage } from '../../../lib/api/admin';
import { adminApi } from '../../../lib/api/admin';
import { getAdminSocket } from '../../../lib/realtime';
import { playMessageSound, playNewTicketSound } from '../../../lib/sounds';
import { TicketConversation } from './[id]/TicketConversation';
import { cn } from '../../../lib/cn';
import { shortId } from '../../../lib/format';

const statusDot: Record<string, string> = {
  WAITING_MODERATOR: 'bg-red-500',
  WAITING_USER: 'bg-yellow-400',
  OPEN: 'bg-blue-400',
  CLOSED: 'bg-zinc-300',
};

const statusLabel: Record<string, string> = {
  WAITING_MODERATOR: 'Ждёт ответа',
  WAITING_USER: 'Ждёт пользователя',
  OPEN: 'Открыт',
  CLOSED: 'Закрыт',
};

const typeLabel: Record<string, string> = {
  CODE_PURCHASE: 'Покупка кода',
  WITHDRAWAL: 'Вывод',
  SUPPORT: 'Поддержка',
};

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) {
    return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' });
}

/**
 * Вкладки списка. «В работе» — диалог живёт, но ответа от нас не ждут:
 * либо мы уже ответили (WAITING_USER), либо тикет просто открыт.
 */
type StatusTab = 'all' | 'waiting' | 'active' | 'closed';

const STATUS_TABS: { id: StatusTab; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'waiting', label: 'Ждут ответа' },
  { id: 'active', label: 'В работе' },
  { id: 'closed', label: 'Закрытые' },
];

function matchesTab(status: string, tab: StatusTab): boolean {
  if (tab === 'all') return status !== 'CLOSED';
  if (tab === 'waiting') return status === 'WAITING_MODERATOR';
  if (tab === 'active') return status === 'OPEN' || status === 'WAITING_USER';
  return status === 'CLOSED';
}

interface PanelData {
  ticket: AdminTicketRow;
  messages: AdminMessage[];
}

interface TicketsDashboardProps {
  initialTickets: AdminTicketRow[];
}

export function TicketsDashboard({ initialTickets }: TicketsDashboardProps) {
  const [tickets, setTickets] = useState(initialTickets);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const [panelData, setPanelData] = useState<PanelData | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<StatusTab>('all');
  // Balance shown in header (updates after adjust)
  const [panelBalance, setPanelBalance] = useState<string | null>(null);
  // External action trigger for TicketConversation forms
  const [actionKey, setActionKey] = useState(0);
  const [actionType, setActionType] = useState<'block' | 'credit' | 'debit' | null>(null);

  // Keep ref in sync for WS handlers
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const selectTicket = useCallback(async (id: string) => {
    if (selectedIdRef.current === id) return;
    setSelectedId(id);
    setPanelData(null);
    setPanelLoading(true);
    try {
      const [ticket, messages] = await Promise.all([
        adminApi.tickets.get(id),
        adminApi.tickets.messages(id, { limit: 30 }),
      ]);
      setPanelData({ ticket, messages });
      setPanelBalance(ticket.userBalanceMinor ?? null);
      setActionType(null);
    } finally {
      setPanelLoading(false);
    }
  }, []);

  // WS: global list updates + sounds
  useEffect(() => {
    const socket = getAdminSocket();

    const onNew = (t: AdminTicketRow) => {
      setTickets((prev) => {
        if (prev.some((x) => x.id === t.id)) return prev;
        playNewTicketSound();
        return [t, ...prev];
      });
    };

    const onUpdated = (data: {
      ticketId: string;
      status?: string;
      lastMessagePreview?: string | null;
      lastMessageAt?: string | null;
    }) => {
      // Play sound for user messages when not viewing that ticket
      if (data.status === 'WAITING_MODERATOR' && data.ticketId !== selectedIdRef.current) {
        playMessageSound();
      }
      setTickets((prev) => {
        const idx = prev.findIndex((t) => t.id === data.ticketId);
        if (idx === -1) return prev;
        const base = prev[idx]!;
        const updated: AdminTicketRow = {
          ...base,
          status: (data.status as AdminTicketRow['status']) ?? base.status,
          lastMessagePreview:
            data.lastMessagePreview !== undefined ? data.lastMessagePreview : base.lastMessagePreview,
          lastMessageAt:
            data.lastMessageAt !== undefined ? data.lastMessageAt : base.lastMessageAt,
        };
        return [updated, ...prev.filter((_, i) => i !== idx)];
      });
    };

    socket.on('tickets:new', onNew);
    socket.on('tickets:updated', onUpdated);
    return () => {
      socket.off('tickets:new', onNew);
      socket.off('tickets:updated', onUpdated);
    };
  }, []);

  const searchLower = search.trim().toLowerCase();
  const filtered = tickets.filter((t) => {
    if (!matchesTab(t.status, tab)) return false;
    if (!searchLower) return true;
    return (
      (t.username ?? '').toLowerCase().includes(searchLower) ||
      (t.subject ?? '').toLowerCase().includes(searchLower) ||
      t.id.includes(searchLower)
    );
  });

  const tabCounts: Record<StatusTab, number> = {
    all: tickets.filter((t) => matchesTab(t.status, 'all')).length,
    waiting: tickets.filter((t) => matchesTab(t.status, 'waiting')).length,
    active: tickets.filter((t) => matchesTab(t.status, 'active')).length,
    closed: tickets.filter((t) => matchesTab(t.status, 'closed')).length,
  };

  const handleAction = (type: 'block' | 'credit' | 'debit') => {
    setActionType(type);
    setActionKey((k) => k + 1);
  };

  const handleBalanceUpdated = (newBalanceMinor: string) => {
    setPanelBalance(newBalanceMinor);
  };

  /** Статус сменили в переписке — обновляем и список слева, и шапку панели. */
  const handleStatusChanged = (status: AdminTicketRow['status']) => {
    const id = panelData?.ticket.id;
    if (!id) return;
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    setPanelData((prev) => (prev ? { ...prev, ticket: { ...prev.ticket, status } } : prev));
  };

  const unreadCount = tickets.filter((t) => t.status === 'WAITING_MODERATOR').length;

  return (
    <div className="flex rounded-xl border border-border overflow-hidden bg-surface" style={{ height: 'calc(100vh - 196px)' }}>
      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <div className="w-[300px] flex-shrink-0 border-r border-border flex flex-col bg-elevated/30">
        {/* Search + filter */}
        <div className="p-3 border-b border-border space-y-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск..."
            className="w-full px-3 py-2 text-sm rounded-lg bg-surface border border-border text-ink-900 placeholder-ink-400 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
          {/* Статусы: переключение без перезагрузки — список уже в памяти */}
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5">
            {STATUS_TABS.map((opt) => {
              const count = tabCounts[opt.id];
              const active = tab === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTab(opt.id)}
                  aria-pressed={active}
                  title={opt.label}
                  className={cn(
                    'flex-1 rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors truncate',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-ink-500 hover:bg-elevated hover:text-ink-900',
                  )}
                >
                  {opt.label}
                  {count > 0 && <span className="ml-1 opacity-60">{count}</span>}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-ink-500">
            <span>
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold mr-1.5">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
              {filtered.length} диалогов
            </span>
          </div>
        </div>

        {/* Ticket list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-ink-400">Нет диалогов</div>
          )}
          {filtered.map((ticket) => {
            const isSelected = selectedId === ticket.id;
            const isUnread = ticket.status === 'WAITING_MODERATOR';
            return (
              <button
                key={ticket.id}
                onClick={() => selectTicket(ticket.id)}
                className={cn(
                  'w-full text-left px-4 py-3 transition-colors flex items-start gap-3 border-b border-border/40',
                  isSelected
                    ? 'bg-primary/10 border-l-[3px] border-l-primary'
                    : 'hover:bg-elevated/80 border-l-[3px] border-l-transparent',
                )}
              >
                {/* Status dot */}
                <span
                  className={cn(
                    'mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ring-2 ring-surface',
                    statusDot[ticket.status] ?? 'bg-zinc-300',
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-1">
                    <span
                      className={cn(
                        'text-sm truncate',
                        isUnread ? 'font-semibold text-ink-900' : 'font-medium text-ink-700',
                      )}
                    >
                      {ticket.username ?? shortId(ticket.userId)}
                    </span>
                    <span className="text-[11px] text-ink-400 flex-shrink-0">
                      {formatTime(ticket.lastMessageAt ?? ticket.updatedAt)}
                    </span>
                  </div>
                  <div
                    className={cn(
                      'text-xs truncate mt-0.5',
                      isUnread ? 'text-ink-600 font-medium' : 'text-ink-400',
                    )}
                  >
                    {ticket.lastMessagePreview ?? ticket.subject ?? typeLabel[ticket.type] ?? '—'}
                  </div>
                  {!isSelected && (
                    <div className="text-[10px] text-ink-400 mt-0.5">
                      {typeLabel[ticket.type]}
                    </div>
                  )}
                </div>
                {isUnread && !isSelected && (
                  <span className="mt-1 h-2 w-2 rounded-full bg-red-500 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Conversation panel ─────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col min-w-0">
        {!selectedId ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-ink-400">
            <p className="text-sm">Выберите диалог слева</p>
          </div>
        ) : panelLoading || !panelData ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin w-7 h-7 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Panel header */}
            <div className="px-5 py-3 border-b border-border bg-elevated/50 flex-shrink-0">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                {/* Left: user info */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn('h-2.5 w-2.5 rounded-full flex-shrink-0', statusDot[panelData.ticket.status] ?? 'bg-zinc-300')} />
                  <span className="text-sm font-semibold text-ink-900 truncate">
                    {panelData.ticket.username ?? shortId(panelData.ticket.userId)}
                  </span>
                  <span className="text-xs text-ink-400 hidden sm:block truncate">
                    · {panelData.ticket.subject ?? typeLabel[panelData.ticket.type]}
                  </span>
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0',
                    panelData.ticket.status === 'WAITING_MODERATOR' ? 'bg-red-100 text-red-600' :
                    panelData.ticket.status === 'WAITING_USER' ? 'bg-yellow-100 text-yellow-700' :
                    panelData.ticket.status === 'OPEN' ? 'bg-blue-100 text-blue-600' :
                    'bg-zinc-100 text-zinc-500'
                  )}>
                    {statusLabel[panelData.ticket.status]}
                  </span>
                </div>

                {/* Right: balance + actions + link */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* Balance – large and prominent */}
                  {panelBalance !== null && (
                    <div className="text-right border-r border-border pr-3">
                      <div className="text-[10px] text-ink-400 leading-none uppercase tracking-wide">Баланс</div>
                      <div className="text-xl font-bold text-ink-900 leading-tight tabular-nums">
                        {(Number(panelBalance) / 100).toFixed(2)}
                        <span className="text-xs font-normal text-ink-500 ml-1">AZN</span>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  {panelData.ticket.status !== 'CLOSED' && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleAction('credit')}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-success/10 text-success hover:bg-success/20 transition-colors"
                      >
                        + Начислить
                      </button>
                      <button
                        onClick={() => handleAction('debit')}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
                      >
                        − Списать
                      </button>
                      <button
                        onClick={() => handleAction('block')}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors"
                      >
                        Бан
                      </button>
                    </div>
                  )}

                  <a
                    href={`/vkadm/tickets/${panelData.ticket.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    Открыть →
                  </a>
                </div>
              </div>
            </div>

            {/* Conversation */}
            <div className="flex-1 overflow-hidden">
              <TicketConversation
                key={panelData.ticket.id}
                ticketId={panelData.ticket.id}
                userId={panelData.ticket.userId}
                initialMessages={panelData.messages}
                ticketStatus={panelData.ticket.status}
                oldestMessageId={panelData.messages[0]?.id ?? null}
                panelMode
                externalAction={actionType ? { type: actionType, key: actionKey } : null}
                onBalanceUpdated={handleBalanceUpdated}
                onStatusChanged={handleStatusChanged}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
