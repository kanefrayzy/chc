import Link from 'next/link';
import { adminApi } from '../../../lib/api/admin';
import { cookieHeaderFromRequest } from '../../../lib/api/server';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { TicketsList } from './TicketsList';

export const dynamic = 'force-dynamic';

const FILTER_TABS = [
  { label: 'Ждёт модератора', value: 'WAITING_MODERATOR' },
  { label: 'Ждёт пользователя', value: 'WAITING_USER' },
  { label: 'Открытые', value: 'OPEN' },
  { label: 'Закрытые', value: 'CLOSED' },
  { label: 'Все', value: '' },
];

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const cookie = cookieHeaderFromRequest();
  const status = searchParams.status ?? 'WAITING_MODERATOR';
  const res = await adminApi.tickets.list({ status: status || undefined, limit: 50 }, { cookie });

  return (
    <>
      <PageHeader title="Тикеты" subtitle="Сообщения от пользователей и сопровождение заявок" />
      {/* Фильтры */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {FILTER_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value ? `/tickets?status=${tab.value}` : '/tickets?status='}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              status === tab.value
                ? 'bg-primary text-white'
                : 'bg-surface border border-border text-ink-600 hover:bg-elevated'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      <Card>
        <TicketsList initialItems={res.items} status={status} />
      </Card>
    </>
  );
}
