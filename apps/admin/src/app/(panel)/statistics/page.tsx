import Link from 'next/link';
import { redirect } from 'next/navigation';
import { adminApi } from '../../../lib/api/admin';
import { cookieHeaderFromRequest, getServerUser, isSuperAdmin } from '../../../lib/api/server';
import { PageHeader } from '../../../components/ui/PageHeader';
import { StatCard } from '../dashboard/StatCard';
import { minorToAzn } from '../../../lib/format';
import { StatisticsCharts } from './StatisticsCharts';

export const dynamic = 'force-dynamic';

const RANGES = [7, 14, 30, 90];

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: { days?: string };
}) {
  const me = await getServerUser();
  if (!isSuperAdmin(me)) {
    redirect('/dashboard');
  }
  const cookie = cookieHeaderFromRequest();

  const days = RANGES.includes(Number(searchParams.days)) ? Number(searchParams.days) : 30;
  const [stats, series] = await Promise.all([
    adminApi.dashboard({ cookie }),
    adminApi.dashboardTimeseries(days, { cookie }),
  ]);

  const t = series.totals;
  const net = BigInt(t.netMinor);
  const ggr = BigInt(t.ggrMinor);

  return (
    <>
      <PageHeader title="Статистика" subtitle={`Динамика за ${days} дн. — пополнения, выводы, GGR и регистрации`} />

      {/* Выбор периода */}
      <div className="mb-5 flex gap-1 rounded-lg bg-ink-50 p-1 w-fit">
        {RANGES.map((r) => (
          <Link
            key={r}
            href={`/statistics?days=${r}`}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              r === days ? 'bg-surface text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'
            }`}
          >
            {r} дн.
          </Link>
        ))}
      </div>

      {/* Сводка за период */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard
          label={`Регистрации за ${days} дн.`}
          value={String(t.registrations)}
          tone="info"
        />
        <StatCard
          label="Пополнения за период"
          value={minorToAzn(t.depositsAmountMinor)}
          hint={`${t.depositsCount} операций`}
          tone="success"
        />
        <StatCard
          label="Выводы за период"
          value={minorToAzn(t.withdrawalsAmountMinor)}
          hint={`${t.withdrawalsCount} операций`}
          tone="warning"
        />
        <StatCard
          label="Чистый поток (деп − вывод)"
          value={minorToAzn(t.netMinor)}
          tone={net >= 0n ? 'success' : 'warning'}
        />
        <StatCard
          label="GGR за период"
          value={minorToAzn(t.ggrMinor)}
          hint="Рулетка + Mines"
          tone={ggr >= 0n ? 'success' : 'warning'}
        />
        <StatCard
          label="Всего пользователей"
          value={String(stats.usersTotal)}
          hint={`Активны за сутки: ${stats.usersActive24h}`}
          tone="neutral"
          href="/users"
        />
      </div>

      {/* График */}
      <div className="mb-6">
        <StatisticsCharts points={series.points} />
      </div>

      {/* Таблица по дням */}
      <div className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-ink-700">Разбивка по дням</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ink-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                <th className="px-4 py-3">Дата</th>
                <th className="px-4 py-3">Регистрации</th>
                <th className="px-4 py-3">Пополнения</th>
                <th className="px-4 py-3">Выводы</th>
                <th className="px-4 py-3">GGR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...series.points].reverse().map((p) => {
                const dayGgr = BigInt(p.ggrMinor);
                return (
                  <tr key={p.date} className="hover:bg-ink-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-ink-700">
                      {new Date(`${p.date}T00:00:00`).toLocaleDateString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-ink-700">{p.registrations}</td>
                    <td className="px-4 py-3 font-mono text-success">
                      {minorToAzn(p.depositsAmountMinor)}
                      <span className="ml-1 text-xs text-ink-400">({p.depositsCount})</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-warning">
                      {minorToAzn(p.withdrawalsAmountMinor)}
                      <span className="ml-1 text-xs text-ink-400">({p.withdrawalsCount})</span>
                    </td>
                    <td className={`px-4 py-3 font-mono font-semibold ${dayGgr >= 0n ? 'text-success' : 'text-danger'}`}>
                      {dayGgr >= 0n ? '+' : ''}{minorToAzn(p.ggrMinor)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
