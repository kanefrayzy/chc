import { adminApi } from '../../../lib/api/admin';
import { cookieHeaderFromRequest } from '../../../lib/api/server';
import { minorToAzn } from '../../../lib/format';
import { PageHeader } from '../../../components/ui/PageHeader';
import { StatCard } from './StatCard';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const cookie = cookieHeaderFromRequest();
  const stats = await adminApi.dashboard({ cookie });

  return (
    <>
      <PageHeader
        title="Сводка"
        subtitle="Текущая операционная нагрузка"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Выводы на модерации"
          value={String(stats.pendingWithdrawalsCount)}
          hint={minorToAzn(stats.pendingWithdrawalsAmountMinor) + ' всего'}
          tone="warning"
          href="/withdrawals?status=PENDING"
        />
        <StatCard
          label="Открытые покупки кода"
          value={String(stats.openCodePurchasesCount)}
          tone="info"
          href="/code-purchases?status=AWAITING_MODERATOR"
        />
        <StatCard
          label="Открытые тикеты"
          value={String(stats.openTicketsCount)}
          tone="primary"
          href="/tickets?status=WAITING_MODERATOR"
        />
        <StatCard
          label="Всего пользователей"
          value={String(stats.usersTotal)}
          tone="neutral"
          href="/users"
        />
        <StatCard
          label="Активны за сутки"
          value={String(stats.usersActive24h)}
          tone="success"
        />
      </div>
    </>
  );
}
