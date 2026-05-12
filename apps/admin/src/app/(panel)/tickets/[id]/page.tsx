import { adminApi } from '../../../../lib/api/admin';
import { cookieHeaderFromRequest } from '../../../../lib/api/server';
import { PageHeader } from '../../../../components/ui/PageHeader';
import { Card } from '../../../../components/ui/Card';
import { formatDateTime, shortId } from '../../../../lib/format';
import { Badge } from '../../../../components/ui/Badge';
import { TicketConversation } from './TicketConversation';

export const dynamic = 'force-dynamic';

export default async function TicketDetailPage({ params }: { params: { id: string } }) {
  const cookie = cookieHeaderFromRequest();
  const [ticket, messages] = await Promise.all([
    adminApi.tickets.get(params.id, { cookie }),
    adminApi.tickets.messages(params.id, { cookie }),
  ]);

  return (
    <>
      <PageHeader
        title={`Тикет ${shortId(ticket.id, 6, 4)}`}
        subtitle={ticket.subject ?? undefined}
        actions={<Badge tone="info">{ticket.status}</Badge>}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card>
            <TicketConversation ticketId={ticket.id} initialMessages={messages} ticketStatus={ticket.status} />
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Информация">
            <dl className="text-sm space-y-2">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">Тип</dt>
                <dd className="text-ink-900">{ticket.type}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">Пользователь</dt>
                <dd className="text-ink-900">{ticket.username ?? shortId(ticket.userId)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">Модератор</dt>
                <dd className="text-ink-900">{ticket.moderatorUsername ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">Создан</dt>
                <dd className="text-ink-700">{formatDateTime(ticket.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">Обновлён</dt>
                <dd className="text-ink-700">{formatDateTime(ticket.updatedAt)}</dd>
              </div>
              {ticket.closedAt && (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-500">Закрыт</dt>
                  <dd className="text-ink-700">{formatDateTime(ticket.closedAt)}</dd>
                </div>
              )}
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
