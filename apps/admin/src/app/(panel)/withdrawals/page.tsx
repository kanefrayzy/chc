import { adminApi } from '../../../lib/api/admin';
import { cookieHeaderFromRequest } from '../../../lib/api/server';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { WithdrawalsTable } from './WithdrawalsTable';
import { PayoutModeSwitch } from './PayoutModeSwitch';

export const dynamic = 'force-dynamic';

export default async function WithdrawalsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const cookie = cookieHeaderFromRequest();
  const status = searchParams.status ?? 'PENDING';
  const [initial, settings] = await Promise.all([
    adminApi.withdrawals.list({ status, limit: 50 }, { cookie }),
    adminApi.settings.list({ cookie }).catch(() => ({ items: [] })),
  ]);

  const findSetting = (key: string, fallback: string): string => {
    const row = settings.items.find((s) => s.key === key);
    const value = row?.value;
    return value === undefined || value === null ? fallback : String(value).replace(/^"|"$/g, '');
  };

  return (
    <>
      <PageHeader title="Выводы" subtitle="Заявки на вывод средств" />
      <PayoutModeSwitch
        initialMode={findSetting('withdrawal.auto_mode', 'manual')}
        thresholdMinor={findSetting('withdrawal.manual_threshold_minor', '200000')}
      />
      <Card>
        <WithdrawalsTable initialItems={initial.items} status={status} />
      </Card>
    </>
  );
}
