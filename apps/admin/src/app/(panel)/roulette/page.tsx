import { redirect } from 'next/navigation';
import { adminApi } from '../../../lib/api/admin';
import { cookieHeaderFromRequest, getServerUser, isSuperAdmin } from '../../../lib/api/server';
import { PageHeader } from '../../../components/ui/PageHeader';
import { StatCard } from '../dashboard/StatCard';
import { RouletteControls } from './RouletteControls';
import { minorToAzn } from '../../../lib/format';

export const dynamic = 'force-dynamic';

const COLOR_BADGE: Record<string, string> = {
  RED: 'bg-red-100 text-red-700',
  GREEN: 'bg-green-100 text-green-700',
  BLACK: 'bg-ink-100 text-ink-700',
};

export default async function RoulettePage() {
  const me = await getServerUser();
  if (!isSuperAdmin(me)) {
    redirect('/dashboard');
  }
  const cookie = cookieHeaderFromRequest();

  const [stats, settings] = await Promise.all([
    adminApi.roulette.stats({ cookie }),
    adminApi.settings.list({ cookie }),
  ]);

  const forcedColorSetting = settings.items.find((s) => s.key === 'roulette.forced_color');
  const currentForcedColor = String(forcedColorSetting?.value ?? '');
  const dailyTargetSetting = settings.items.find((s) => s.key === 'roulette.daily_target_minor');
  const currentDailyTargetMinor = String(dailyTargetSetting?.value ?? '0');

  const todayGgr = BigInt(stats.todayGgrMinor);
  const dailyTarget = BigInt(currentDailyTargetMinor || '0');
  const belowTarget = dailyTarget > 0n && todayGgr < dailyTarget;

  return (
    <>
      <PageHeader
        title="Рулетка"
        subtitle="Статистика, антиминус и управление раундами"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="GGR сегодня"
          value={minorToAzn(stats.todayGgrMinor)}
          tone={todayGgr >= 0n ? 'success' : 'warning'}
          hint={dailyTarget > 0n ? `План: ${minorToAzn(currentDailyTargetMinor)}` : undefined}
        />
        <StatCard
          label="GGR всего"
          value={minorToAzn(stats.allTimeGgrMinor)}
          tone={BigInt(stats.allTimeGgrMinor) >= 0n ? 'success' : 'warning'}
        />
        <StatCard
          label="Раундов сегодня"
          value={String(stats.roundsToday)}
          tone="info"
        />
        <StatCard
          label="Раундов всего"
          value={String(stats.roundsTotal)}
          tone="neutral"
        />
      </div>

      {/* Anti-minus warning */}
      {belowTarget && (
        <div className="mb-6 rounded-2xl border border-orange-200 bg-orange-50 px-5 py-4">
          <p className="text-sm font-semibold text-orange-700">
            ⚠ GGR за сегодня ({minorToAzn(stats.todayGgrMinor)}) ниже суточного плана ({minorToAzn(currentDailyTargetMinor)}).
            Используйте принудительный цвет для управления балансом раундов.
          </p>
        </div>
      )}

      {/* Controls */}
      <RouletteControls
        currentForcedColor={currentForcedColor}
        currentDailyTargetMinor={currentDailyTargetMinor}
      />

      {/* Recent rounds table */}
      <div className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-ink-700">Последние 20 раундов</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ink-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Цвет</th>
                <th className="px-4 py-3">Слот</th>
                <th className="px-4 py-3">Ставок</th>
                <th className="px-4 py-3">Общие ставки</th>
                <th className="px-4 py-3">Выплаты</th>
                <th className="px-4 py-3">GGR</th>
                <th className="px-4 py-3">Завершён</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stats.recentRounds.map((r) => {
                const ggr = BigInt(r.ggrMinor);
                return (
                  <tr key={r.id} className="hover:bg-ink-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-ink-500">{r.id.slice(0, 8)}…</td>
                    <td className="px-4 py-3">
                      {r.winningColor ? (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${COLOR_BADGE[r.winningColor] ?? 'bg-ink-100 text-ink-700'}`}>
                          {r.winningColor}
                        </span>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-700">{r.winningSlot ?? '—'}</td>
                    <td className="px-4 py-3 text-ink-700">{r.betsCount}</td>
                    <td className="px-4 py-3 font-mono text-ink-700">{minorToAzn(r.totalBetsMinor)}</td>
                    <td className="px-4 py-3 font-mono text-ink-700">{minorToAzn(r.totalPayoutsMinor)}</td>
                    <td className={`px-4 py-3 font-mono font-semibold ${ggr >= 0n ? 'text-success' : 'text-danger'}`}>
                      {ggr >= 0n ? '+' : ''}{minorToAzn(r.ggrMinor)}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-500">
                      {r.completedAt ? new Date(r.completedAt).toLocaleString('ru-RU') : '—'}
                    </td>
                  </tr>
                );
              })}
              {stats.recentRounds.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-ink-400">
                    Раундов пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
