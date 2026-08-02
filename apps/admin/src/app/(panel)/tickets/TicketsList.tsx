'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { adminApi, type AdminTicketRow } from '../../../lib/api/admin';
import { getAdminSocket } from '../../../lib/realtime';
import { formatDateTime, shortId } from '../../../lib/format';
import { Badge } from '../../../components/ui/Badge';
import { DataTable } from '../../../components/ui/DataTable';
import { playNewTicketSound } from '../../../lib/sounds';

const statusTone: Record<AdminTicketRow['status'], 'neutral' | 'info' | 'warning' | 'danger' | 'success'> = {
  OPEN: 'info',
  WAITING_MODERATOR: 'danger',
  WAITING_USER: 'info',
  CLOSED: 'neutral',
};

const statusLabel: Record<AdminTicketRow['status'], string> = {
  OPEN: 'Открыт',
  WAITING_MODERATOR: 'Ждёт модератора',
  WAITING_USER: 'Ждёт пользователя',
  CLOSED: 'Закрыт',
};

const typeLabel: Record<AdminTicketRow['type'], string> = {
  CODE_PURCHASE: 'Покупка кода',
  WITHDRAWAL: 'Вывод',
  SUPPORT: 'Поддержка',
};

interface TicketsListProps {
  initialItems: AdminTicketRow[];
  status: string;
}

export function TicketsList({ initialItems, status }: TicketsListProps) {
  const [tickets, setTickets] = useState(initialItems);

  // Страховка поверх WebSocket: список обновляется сам, даже если сокет
  // не авторизовался (истёкший токен) — без перезагрузки страницы.
  useEffect(() => {
    let cancelled = false;
    const timer = setInterval(() => {
      if (document.hidden) return;
      adminApi.tickets
        .list({ ...(status ? { status } : {}), limit: 50 })
        .then((res) => {
          if (!cancelled) setTickets(res.items);
        })
        .catch(() => {
          /* молча — повторим на следующем тике */
        });
    }, 15_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [status]);

  useEffect(() => {
    const socket = getAdminSocket();

    // Новый тикет — добавляем в начало если фильтр подходит
    const onNew = (t: AdminTicketRow) => {
      if (status && status !== t.status) return;
      setTickets((prev) => {
        if (prev.some((x) => x.id === t.id)) return prev;
        playNewTicketSound();
        return [t as AdminTicketRow, ...prev];
      });
    };

    // Обновление тикета (новое сообщение, смена статуса)
    const onUpdated = (data: { ticketId: string; status?: string; lastMessagePreview?: string | null; lastMessageAt?: string | null }) => {
      setTickets((prev: AdminTicketRow[]): AdminTicketRow[] => {
        const idx = prev.findIndex((t) => t.id === data.ticketId);
        const base = prev[idx];
        if (idx === -1 || !base) return prev;
        const updated: AdminTicketRow = {
          id: base.id,
          userId: base.userId,
          username: base.username,
          userBalanceMinor: base.userBalanceMinor,
          moderatorId: base.moderatorId,
          moderatorUsername: base.moderatorUsername,
          type: base.type,
          status: (data.status as AdminTicketRow['status']) ?? base.status,
          subject: base.subject,
          lastMessagePreview: data.lastMessagePreview !== undefined ? data.lastMessagePreview : base.lastMessagePreview,
          lastMessageAt: data.lastMessageAt !== undefined ? data.lastMessageAt : base.lastMessageAt,
          createdAt: base.createdAt,
          updatedAt: base.updatedAt,
          closedAt: base.closedAt,
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
  }, [status]);

  return (
    <DataTable
      rows={tickets}
      empty="Нет тикетов"
      columns={[
        {
          key: 'id',
          header: 'ID',
          cell: (t) => (
            <Link href={`/tickets/${t.id}`} className="font-mono text-xs text-primary hover:underline">
              {shortId(t.id)}
            </Link>
          ),
        },
        {
          key: 'type',
          header: 'Тип',
          cell: (t) => <span className="text-sm text-ink-700">{typeLabel[t.type]}</span>,
        },
        {
          key: 'user',
          header: 'Пользователь',
          cell: (t) => <span className="text-sm text-ink-900">{t.username ?? '—'}</span>,
        },
        {
          key: 'subject',
          header: 'Тема',
          cell: (t) => (
            <div className="max-w-[300px]">
              <div className="text-sm text-ink-700 truncate">{t.subject ?? '—'}</div>
              {t.lastMessagePreview && (
                <div className="text-xs text-ink-400 truncate">{t.lastMessagePreview}</div>
              )}
            </div>
          ),
        },
        {
          key: 'status',
          header: 'Статус',
          cell: (t) => <Badge tone={statusTone[t.status]}>{statusLabel[t.status]}</Badge>,
        },
        {
          key: 'updated',
          header: 'Обновлён',
          cell: (t) => (
            <span className="text-sm text-ink-500">{formatDateTime(t.updatedAt)}</span>
          ),
        },
        {
          key: 'open',
          header: '',
          align: 'right' as const,
          cell: (t) => (
            <Link
              href={`/tickets/${t.id}`}
              className="text-xs font-medium text-primary hover:text-primary-dark"
            >
              Открыть →
            </Link>
          ),
        },
      ]}
    />
  );
}
