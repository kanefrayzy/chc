import { adminApi } from '../../../lib/api/admin';
import { cookieHeaderFromRequest } from '../../../lib/api/server';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { CodePurchasesTable } from './CodePurchasesTable';

export const dynamic = 'force-dynamic';

export default async function CodePurchasesPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const cookie = cookieHeaderFromRequest();
  const status = searchParams.status ?? 'AWAITING_MODERATOR';
  const initial = await adminApi.codePurchases.list({ status, limit: 50 }, { cookie });

  return (
    <>
      <PageHeader
        title="Покупки кода"
        subtitle="Заявки на выдачу кодов через чат с модератором"
      />
      <Card>
        <CodePurchasesTable initialItems={initial.items} status={status} />
      </Card>
    </>
  );
}
