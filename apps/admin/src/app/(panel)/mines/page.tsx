import { redirect } from 'next/navigation';
import { adminApi } from '../../../lib/api/admin';
import { cookieHeaderFromRequest, getServerUser, isSuperAdmin } from '../../../lib/api/server';
import { PageHeader } from '../../../components/ui/PageHeader';
import { StatCard } from '../dashboard/StatCard';
import { MinesControls } from './MinesControls';
import { minorToAzn } from '../../../lib/format';

export const dynamic = 'force-dynamic';

const STATUS_BADGE: Record<string, string> = {
  CASHED_OUT: 'bg-green-100 text-green-700',
  BUSTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-ink-100 text-ink-700',
  ACTIVE: 'bg-amber-100 text-amber-700',
};

export default async function MinesPage() {
  const me = await getServerUser();
  if (!isSuperAdmin(me)) {
    redirect('/dashboard');
  }
  const cookie = cookieHeaderFromRequest();

  const [stats, settings] = await Promise.all([
    adminApi.mines.stats({ cookie }),
    adminApi.settings.list({ cookie }),
  ]);

  const find = (key: string): string =>
    String(settings.items.find((s) => s.key === key)?.value ?? '');

  const enabled = settings.items.find((s) => s.key === 'gameplay.mines_enabled')?.value !== false;
  const houseEdgeBps = Number(
    settings.items.find((s) => s.key === 'mines.house_edge_bps')?.value ?? 100,
  );
  const minBetMinor = find('mines.min_bet_minor') || '100';
  const maxBetMinor = find('mines.max_bet_minor') || '100000';
  const iconGem = find('mines.icon_url.gem');
  const iconBomb = find('mines.icon_url.bomb');

  const todayGgr = BigInt(stats.todayGgrMinor);
  const allTimeGgr = BigInt(stats.allTimeGgrMinor);
  const targetPct = houseEdgeBps / 100;
  const belowTarget = targetPct > 0 && stats.todayGgrPct < targetPct;

  return (
    <>
      <PageHeader
        title="Mines"
        subtitle="Профит казино, RTP, активные партии и управление"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="GGR сегодня"
          value={minorToAzn(stats.todayGgrMinor)}
          tone={todayGgr >= 0n ? 'success' : 'warning'}
          hint={`GGR%: ${stats.todayGgrPct.toFixed(2)}% / цель: ${targetPct.toFixed(2)}%`}
        />
        <StatCard
          label="GGR всего"
          value={minorToAzn(stats.allTimeGgrMinor)}
          tone={allTimeGgr >= 0n ? 'success' : 'warning'}
          hint={`RTP всего: ${stats.allTimeRtpPct.toFixed(2)}%`}
        />
        <StatCard
          label="Партий сегодня"
          value={String(stats.gamesToday)}
          tone="info"
          hint={`Оборот: ${minorToAzn(stats.todayWageredMinor)}`}
        />
        <StatCard
          label="Активных сейчас"
          value={String(stats.activeGames)}
          tone="neutral"
          hint={`Всего завершено: ${stats.gamesTotal}`}
        />
      </div>

      {/* Secondary stats: bust vs cashout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Взорвались (BUSTED)"
          value={String(stats.bustedTotal)}
          tone="success"
          hint={`${stats.bustedPct.toFixed(1)}% от завершённых`}
        />
        <StatCard
          label="Забрали (CASHED_OUT)"
          value={String(stats.cashedOutTotal)}
          tone="warning"
          hint={`${(100 - stats.bustedPct).toFixed(1)}% от завершённых`}
        />
        <StatCard
          label="Выплачено всего"
          value={minorToAzn(stats.allTimePaidOutMinor)}
          tone="neutral"
          hint={`Принято: ${minorToAzn(stats.allTimeWageredMinor)}`}
        />
      </div>

      {/* Anti-minus warning */}
      {belowTarget && (
        <div className="mb-6 rounded-2xl border border-orange-200 bg-orange-50 px-5 py-4">
          <p className="text-sm font-semibold text-orange-700">
            ⚠ GGR% за сегодня ({stats.todayGgrPct.toFixed(2)}%) ниже целевого house edge
            ({targetPct.toFixed(2)}%). Повысьте house edge или уменьшите макс. ставку.
          </p>
        </div>
      )}

      {/* Controls */}
      <MinesControls
        currentEnabled={enabled}
        currentHouseEdgeBps={houseEdgeBps}
        currentMinBetMinor={minBetMinor}
        currentMaxBetMinor={maxBetMinor}
        currentIconGem={iconGem}
        currentIconBomb={iconBomb}
      />

      {/* By mine count */}
      <div className="mb-6 rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-ink-700">Профит по количеству мин</h3>
          <p className="mt-1 text-xs text-ink-500">
            Сравните RTP по числу мин. Если на каком-то режиме RTP &gt; 100% — игроки в плюсе, стоит
            проверить house edge.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ink-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                <th className="px-4 py-3">Мин</th>
                <th className="px-4 py-3">Партий</th>
                <th className="px-4 py-3">Оборот</th>
                <th className="px-4 py-3">Выплачено</th>
                <th className="px-4 py-3">GGR</th>
                <th className="px-4 py-3">RTP %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stats.byMineCount.map((r) => {
                const ggr = BigInt(r.ggrMinor);
                return (
                  <tr key={r.mineCount} className="hover:bg-ink-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-ink-700">{r.mineCount}</td>
                    <td className="px-4 py-3 text-ink-700">{r.games}</td>
                    <td className="px-4 py-3 font-mono text-ink-700">{minorToAzn(r.wageredMinor)}</td>
                    <td className="px-4 py-3 font-mono text-ink-700">{minorToAzn(r.paidOutMinor)}</td>
                    <td className={`px-4 py-3 font-mono font-semibold ${ggr >= 0n ? 'text-success' : 'text-danger'}`}>
                      {ggr >= 0n ? '+' : ''}{minorToAzn(r.ggrMinor)}
                    </td>
                    <td className={`px-4 py-3 font-mono ${r.rtpPct > 100 ? 'text-danger font-semibold' : 'text-ink-700'}`}>
                      {r.rtpPct.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
              {stats.byMineCount.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-ink-400">
                    Данных пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent games table */}
      <div className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-ink-700">Последние 20 партий</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ink-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Игрок</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Мин</th>
                <th className="px-4 py-3">Открыто</th>
                <th className="px-4 py-3">Ставка</th>
                <th className="px-4 py-3">Выплата</th>
                <th className="px-4 py-3">×</th>
                <th className="px-4 py-3">GGR</th>
                <th className="px-4 py-3">Завершён</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stats.recentGames.map((g) => {
                const ggr = BigInt(g.ggrMinor);
                return (
                  <tr key={g.id} className="hover:bg-ink-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-ink-500">{g.id.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-ink-700">{g.username}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[g.status] ?? 'bg-ink-100 text-ink-700'}`}>
                        {g.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-700">{g.mineCount}</td>
                    <td className="px-4 py-3 text-ink-700">{g.revealedCount}</td>
                    <td className="px-4 py-3 font-mono text-ink-700">{minorToAzn(g.betMinor)}</td>
                    <td className="px-4 py-3 font-mono text-ink-700">{minorToAzn(g.payoutMinor)}</td>
                    <td className="px-4 py-3 font-mono text-ink-700">{(g.multiplierBps / 10000).toFixed(2)}×</td>
                    <td className={`px-4 py-3 font-mono font-semibold ${ggr >= 0n ? 'text-success' : 'text-danger'}`}>
                      {ggr >= 0n ? '+' : ''}{minorToAzn(g.ggrMinor)}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-500">
                      {g.completedAt ? new Date(g.completedAt).toLocaleString('ru-RU') : '—'}
                    </td>
                  </tr>
                );
              })}
              {stats.recentGames.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-sm text-ink-400">
                    Партий пока нет
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
