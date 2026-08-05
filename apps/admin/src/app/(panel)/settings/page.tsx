import { redirect } from 'next/navigation';
import { adminApi } from '../../../lib/api/admin';
import { cookieHeaderFromRequest, getServerUser, isSuperAdmin } from '../../../lib/api/server';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Alert } from '../../../components/ui/Alert';
import { SettingsTable } from './SettingsTable';
import { ExchangeRatesRefreshButton } from './ExchangeRatesRefreshButton';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const me = await getServerUser();
  if (!isSuperAdmin(me)) {
    redirect('/dashboard');
  }
  const cookie = cookieHeaderFromRequest();
  const res = await adminApi.settings.list({ cookie });

  return (
    <>
      <PageHeader
        title="Настройки"
        subtitle="Фиче-флаги, лимиты и параметры реферальной программы"
      />
      <Alert tone="warning" className="mb-4">
        Лимиты <code>deposit.min_amount_minor</code> и <code>deposit.max_amount_minor</code>{' '}
        применяются только к способам оплаты без собственных лимитов. Если у способа на странице{' '}
        <a href="/vkadm/payment-methods" className="underline">
          «Платёжные методы»
        </a>{' '}
        задан свой минимум — главнее он. Betatransfer при этом не принимает платежи меньше 50 AZN:
        сумму ниже он отклонит на своей стороне, даже если сайт её пропустит.
      </Alert>
      <Alert tone="info" className="mb-4">
        Изменения применяются ко всем инстансам после ~1 минуты (TTL кэша). Каждое изменение
        фиксируется в audit-log.
      </Alert>

      {/* Курсы валют */}
      <div className="mb-6 rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h2 className="mb-3 text-sm font-semibold text-ink-900">Курсы валют (платёжные системы)</h2>
        <p className="mb-4 text-xs text-ink-500">
          Курсы хранятся как настройки <code>exchange_rate.usd / .rub / .try</code> и используются
          для конвертации суммы AZN в валюту платёжного метода. Вы можете обновить их автоматически
          или отредактировать вручную в таблице ниже.
        </p>
        <ExchangeRatesRefreshButton />
      </div>

      <SettingsTable initialItems={res.items} />
    </>
  );
}
