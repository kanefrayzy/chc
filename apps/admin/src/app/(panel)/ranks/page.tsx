import { redirect } from 'next/navigation';
import { adminApi } from '../../../lib/api/admin';
import { cookieHeaderFromRequest, getServerUser, isSuperAdmin } from '../../../lib/api/server';
import { PageHeader } from '../../../components/ui/PageHeader';
import { RanksPanel } from './RanksPanel';

export const dynamic = 'force-dynamic';

export default async function RanksPage() {
  const me = await getServerUser();
  if (!isSuperAdmin(me)) {
    redirect('/dashboard');
  }
  const cookie = cookieHeaderFromRequest();
  const res = await adminApi.ranks.list({ cookie });

  return (
    <>
      <PageHeader
        title="Ранги"
        subtitle="Управление рангами игроков: порядок, названия, пороги, иконки"
      />
      <RanksPanel initialItems={res.items} />
    </>
  );
}
