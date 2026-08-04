import { adminApi } from '../../../lib/api/admin';
import { cookieHeaderFromRequest } from '../../../lib/api/server';
import { PageHeader } from '../../../components/ui/PageHeader';
import { TransactionsTable } from './TransactionsTable';

export const dynamic = 'force-dynamic';

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const cookie = cookieHeaderFromRequest();
  const status = searchParams.status ?? '';

  const [page, stats] = await Promise.all([
    adminApi.deposits.list({ ...(status ? { status } : {}), limit: 50 }, { cookie }),
    adminApi.deposits.stats({ cookie }).catch(() => ({ items: [] })),
  ]);

  return (
    <>
      <PageHeader
        title="Транзакции"
        subtitle="Пополнения: статусы, выданные реквизиты и номер заказа у провайдера"
      />
      <TransactionsTable initialItems={page.items} initialStats={stats.items} status={status} />
    </>
  );
}
