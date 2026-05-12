import Link from 'next/link';
import { adminApi, type AdminTicketRow } from '../../../lib/api/admin';
import { cookieHeaderFromRequest } from '../../../lib/api/server';
import { formatDateTime, shortId } from '../../../lib/format';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { DataTable } from '../../../components/ui/DataTable';

export const dynamic = 'force-dynamic';

const statusTone: Record<AdminTicketRow['status'], 'neutral' | 'info' | 'warning' | 'success'> = {
  OPEN: 'info',
  WAITING_MODERATOR: 'warning',
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

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const cookie = cookieHeaderFromRequest();
  const status = searchParams.status ?? 'WAITING_MODERATOR';
  const res = await adminApi.tickets.list({ status, limit: 50 }, { cookie });

  return (
    <>
      <PageHeader title="Тикеты" subtitle="Сообщения от пользователей и сопровождение заявок" />
      <Card>
        <DataTable
          rows={res.items}
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
              align: 'right',
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
      </Card>
    </>
  );
}
