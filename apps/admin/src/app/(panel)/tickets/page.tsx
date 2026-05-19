import { adminApi } from '../../../lib/api/admin';
import { cookieHeaderFromRequest } from '../../../lib/api/server';
import { PageHeader } from '../../../components/ui/PageHeader';
import { TicketsDashboard } from './TicketsDashboard';

export const dynamic = 'force-dynamic';

export default async function TicketsPage() {
  const cookie = cookieHeaderFromRequest();
  const res = await adminApi.tickets.list({ limit: 100 }, { cookie });

  return (
    <>
      <PageHeader title="Тикеты" subtitle="Переписка с пользователями" />
      <TicketsDashboard initialTickets={res.items} />
    </>
  );
}

