import { adminApi } from '../../../lib/api/admin';
import { cookieHeaderFromRequest, getServerUser, isSuperAdmin } from '../../../lib/api/server';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { UsersTable } from './UsersTable';

export const dynamic = 'force-dynamic';

export default async function UsersPage({
  searchParams,
}: {
  searchParams: { search?: string };
}) {
  const cookie = cookieHeaderFromRequest();
  const me = await getServerUser();
  const initial = await adminApi.users.list(
    { search: searchParams.search, limit: 50 },
    { cookie },
  );
  return (
    <>
      <PageHeader
        title="Пользователи"
        subtitle="Поиск, балансы и статусы аккаунтов"
      />
      <Card>
        <UsersTable
          initialItems={initial.items}
          search={searchParams.search ?? ''}
          canAdjust={isSuperAdmin(me)}
        />
      </Card>
    </>
  );
}
