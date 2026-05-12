import { adminApi } from '../../../lib/api/admin';
import { cookieHeaderFromRequest } from '../../../lib/api/server';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { WithdrawalsTable } from './WithdrawalsTable';

export const dynamic = 'force-dynamic';

export default async function WithdrawalsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const cookie = cookieHeaderFromRequest();
  const status = searchParams.status ?? 'PENDING';
  const initial = await adminApi.withdrawals.list({ status, limit: 50 }, { cookie });

  return (
    <>
      <PageHeader
        title="Выводы"
        subtitle="Заявки на вывод средств — ручное подтверждение"
      />
      <Card>
        <WithdrawalsTable initialItems={initial.items} status={status} />
      </Card>
    </>
  );
}
