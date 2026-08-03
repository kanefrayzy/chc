import { adminApi } from '../../../lib/api/admin';
import { cookieHeaderFromRequest } from '../../../lib/api/server';
import { PageHeader } from '../../../components/ui/PageHeader';
import { JackpotManager } from './JackpotManager';

export const dynamic = 'force-dynamic';

export default async function JackpotPage() {
  const cookie = cookieHeaderFromRequest();
  const [pools, wins] = await Promise.all([
    adminApi.progressive.list({ cookie }),
    adminApi.progressive.wins({ cookie }).catch(() => ({ items: [] })),
  ]);

  return (
    <>
      <PageHeader
        title="Прогрессивный джекпот"
        subtitle="Четыре копилки, растущие с каждой ставки"
      />
      <JackpotManager initialPools={pools.items} initialWins={wins.items} />
    </>
  );
}
