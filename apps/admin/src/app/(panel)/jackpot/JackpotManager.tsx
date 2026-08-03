'use client';

import { useState } from 'react';
import {
  adminApi,
  type AdminJackpotRow,
  type AdminJackpotWin,
  type AdminUserRow,
  type JackpotTier,
} from '../../../lib/api/admin';
import { ApiException } from '../../../lib/api/client';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { DataTable } from '../../../components/ui/DataTable';
import { minorToAzn, formatDateTime } from '../../../lib/format';

const TIER_LABEL: Record<JackpotTier, string> = {
  GRAND: 'GRAND',
  MAJOR: 'MAJOR',
  MINOR: 'MINOR',
  MINI: 'MINI',
};

const TIER_COLOR: Record<JackpotTier, string> = {
  GRAND: 'text-danger',
  MAJOR: 'text-warning',
  MINOR: 'text-success',
  MINI: 'text-primary',
};

function aznToMinor(input: string): string | null {
  const normalized = input.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, frac = ''] = normalized.split('.');
  return `${BigInt(whole ?? '0') * 100n + BigInt(frac.padEnd(2, '0'))}`;
}

interface Draft {
  seed: string;
  current: string;
  contributionBps: string;
  enabled: boolean;
}

export function JackpotManager({
  initialPools,
  initialWins,
}: {
  initialPools: AdminJackpotRow[];
  initialWins: AdminJackpotWin[];
}) {
  const [pools, setPools] = useState(initialPools);
  const [wins, setWins] = useState(initialWins);
  const [drafts, setDrafts] = useState<Partial<Record<JackpotTier, Draft>>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingTier, setSavingTier] = useState<JackpotTier | null>(null);

  // Розыгрыш
  const [awardTier, setAwardTier] = useState<JackpotTier | null>(null);
  const [search, setSearch] = useState('');
  const [found, setFound] = useState<AdminUserRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [awarding, setAwarding] = useState(false);
  const [confirmUser, setConfirmUser] = useState<AdminUserRow | null>(null);

  const totalContribution = pools
    .filter((p) => p.enabled)
    .reduce((sum, p) => sum + p.contributionBps, 0);

  async function refresh() {
    const [p, w] = await Promise.all([
      adminApi.progressive.list(),
      adminApi.progressive.wins().catch(() => ({ items: wins })),
    ]);
    setPools(p.items);
    setWins(w.items);
    setDrafts({});
  }

  function draftOf(pool: AdminJackpotRow): Draft {
    return (
      drafts[pool.tier] ?? {
        seed: minorToAzn(pool.seedMinor),
        current: minorToAzn(pool.currentMinor),
        contributionBps: String(pool.contributionBps),
        enabled: pool.enabled,
      }
    );
  }

  function setDraft(tier: JackpotTier, patch: Partial<Draft>, pool: AdminJackpotRow) {
    setDrafts((prev) => ({ ...prev, [tier]: { ...draftOf(pool), ...patch } }));
  }

  async function save(pool: AdminJackpotRow) {
    const d = draftOf(pool);
    setError(null);
    setNotice(null);

    const seedMinor = aznToMinor(d.seed);
    const currentMinor = aznToMinor(d.current);
    const bps = Number(d.contributionBps);
    if (!seedMinor) return setError('Стартовая сумма — число, например 500');
    if (!currentMinor) return setError('Текущая сумма — число, например 1500');
    if (!Number.isInteger(bps) || bps < 0 || bps > 2000) {
      return setError('Отчисление задаётся в bps: 0–2000 (100 bps = 1% ставки)');
    }

    setSavingTier(pool.tier);
    try {
      await adminApi.progressive.update(pool.tier, {
        seedMinor,
        currentMinor,
        contributionBps: bps,
        enabled: d.enabled,
      });
      await refresh();
      setNotice(`Копилка ${pool.tier} сохранена`);
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Не удалось сохранить');
    } finally {
      setSavingTier(null);
    }
  }

  async function findUsers() {
    setSearching(true);
    try {
      const res = await adminApi.users.list({ search: search.trim(), limit: 10 });
      setFound(res.items);
    } catch {
      setFound([]);
    } finally {
      setSearching(false);
    }
  }

  async function award() {
    if (!awardTier || !confirmUser) return;
    setError(null);
    setAwarding(true);
    try {
      const res = await adminApi.progressive.award(awardTier, confirmUser.id);
      setNotice(
        `Джекпот ${res.tier} выплачен игроку ${res.username}: ${minorToAzn(res.amountMinor)} AZN`,
      );
      setAwardTier(null);
      setConfirmUser(null);
      setSearch('');
      setFound([]);
      await refresh();
    } catch (e) {
      const msg = e instanceof ApiException ? e.message : '';
      setError(
        msg === 'JACKPOT_EMPTY'
          ? 'Копилка пуста — разыгрывать нечего'
          : msg || 'Не удалось разыграть джекпот',
      );
    } finally {
      setAwarding(false);
    }
  }

  const awardPool = pools.find((p) => p.tier === awardTier) ?? null;

  return (
    <div className="space-y-5">
      {error && <div className="rounded-lg bg-danger/10 px-4 py-2.5 text-sm text-danger">{error}</div>}
      {notice && (
        <div className="rounded-lg bg-success/10 px-4 py-2.5 text-sm text-success">{notice}</div>
      )}

      <Card>
        <p className="text-sm text-ink-600">
          С каждой ставки в рулетке, Mines, классическом и лотерее в копилки уходит доля,
          заданная ниже в bps (100 bps = 1% ставки). Отчисления берутся из маржи казино —
          выплаты по самим играм не меняются. Сейчас в копилки уходит{' '}
          <strong className="text-ink-900">{(totalContribution / 100).toFixed(2)}%</strong> оборота.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {pools.map((pool) => {
          const d = draftOf(pool);
          const dirty = Boolean(drafts[pool.tier]);
          return (
            <Card key={pool.tier}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className={`text-lg font-black tracking-wider ${TIER_COLOR[pool.tier]}`}>
                  {TIER_LABEL[pool.tier]}
                </h2>
                <Badge tone={pool.enabled ? 'success' : 'neutral'}>
                  {pool.enabled ? 'Активна' : 'Отключена'}
                </Badge>
              </div>

              <div className="mb-3 rounded-lg bg-elevated px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-ink-400">Сейчас в копилке</div>
                <div className="font-mono text-2xl font-black tabular-nums text-ink-900">
                  {minorToAzn(pool.currentMinor)} <span className="text-sm">AZN</span>
                </div>
                {pool.lastWinnerName && (
                  <div className="mt-1 text-xs text-ink-500">
                    Последний срыв: {pool.lastWinnerName} — {minorToAzn(pool.lastWinMinor)} AZN
                    {pool.lastWonAt ? `, ${formatDateTime(pool.lastWonAt)}` : ''}
                  </div>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <label className="block">
                  <span className="text-xs text-ink-500">Стартовая сумма, AZN</span>
                  <input
                    value={d.seed}
                    onChange={(e) => setDraft(pool.tier, { seed: e.target.value }, pool)}
                    inputMode="decimal"
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink-900 outline-none focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-ink-500">Текущая сумма, AZN</span>
                  <input
                    value={d.current}
                    onChange={(e) => setDraft(pool.tier, { current: e.target.value }, pool)}
                    inputMode="decimal"
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink-900 outline-none focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-ink-500">Отчисление, bps</span>
                  <input
                    value={d.contributionBps}
                    onChange={(e) => setDraft(pool.tier, { contributionBps: e.target.value }, pool)}
                    inputMode="numeric"
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink-900 outline-none focus:border-primary"
                  />
                </label>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-ink-700">
                  <input
                    type="checkbox"
                    checked={d.enabled}
                    onChange={(e) => setDraft(pool.tier, { enabled: e.target.checked }, pool)}
                  />
                  Показывать на сайте
                </label>
                <Button
                  size="sm"
                  onClick={() => void save(pool)}
                  disabled={!dirty || savingTier === pool.tier}
                >
                  {savingTier === pool.tier ? 'Сохраняем…' : 'Сохранить'}
                </Button>
                <Button
                  size="sm"
                  variant="success"
                  onClick={() => {
                    setAwardTier(pool.tier);
                    setConfirmUser(null);
                    setFound([]);
                    setSearch('');
                  }}
                  disabled={BigInt(pool.currentMinor) <= 0n}
                >
                  Разыграть
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-ink-900">История срывов</h2>
        <DataTable
          rows={wins}
          empty="Джекпот ещё ни разу не срывали"
          columns={[
            {
              key: 'tier',
              header: 'Копилка',
              cell: (w) => (
                <span className={`font-black tracking-wider ${TIER_COLOR[w.tier]}`}>{w.tier}</span>
              ),
            },
            {
              key: 'user',
              header: 'Игрок',
              cell: (w) => <span className="text-sm text-ink-900">{w.username ?? '—'}</span>,
            },
            {
              key: 'amount',
              header: 'Сумма',
              align: 'right',
              cell: (w) => (
                <span className="font-mono font-semibold tabular-nums">
                  {minorToAzn(w.amountMinor)}
                </span>
              ),
            },
            {
              key: 'date',
              header: 'Когда',
              cell: (w) => (
                <span className="text-sm text-ink-500">{formatDateTime(w.createdAt)}</span>
              ),
            },
          ]}
        />
      </Card>

      {/* Розыгрыш */}
      {awardTier && awardPool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-surface p-5 shadow-xl">
            <h3 className="text-base font-semibold text-ink-900">
              Разыграть {awardTier} — {minorToAzn(awardPool.currentMinor)} AZN
            </h3>
            <p className="mt-1 text-xs text-ink-500">
              Вся сумма копилки уйдёт на баланс выбранного игрока, а копилка вернётся к
              стартовому значению {minorToAzn(awardPool.seedMinor)} AZN. Отменить нельзя.
            </p>

            <div className="mt-3 flex gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void findUsers();
                }}
                placeholder="Логин или email игрока"
                className="flex-1 rounded-lg border border-border bg-page px-3 py-2 text-sm text-ink-900 outline-none focus:border-primary"
              />
              <Button onClick={() => void findUsers()} disabled={searching || !search.trim()}>
                {searching ? 'Ищем…' : 'Найти'}
              </Button>
            </div>

            {found.length > 0 && (
              <ul className="mt-3 max-h-48 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {found.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => setConfirmUser(u)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-elevated ${
                        confirmUser?.id === u.id ? 'bg-primary/10' : ''
                      }`}
                    >
                      <span className="text-sm text-ink-900">{u.username}</span>
                      <span className="font-mono text-xs text-ink-400">
                        {minorToAzn(u.balanceMinor)} AZN
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {confirmUser && (
              <div className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-sm text-ink-900">
                Выплатить <strong>{minorToAzn(awardPool.currentMinor)} AZN</strong> игроку{' '}
                <strong>{confirmUser.username}</strong>?
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAwardTier(null)}>
                Отмена
              </Button>
              <Button
                variant="success"
                onClick={() => void award()}
                disabled={!confirmUser || awarding}
              >
                {awarding ? 'Выплачиваем…' : 'Выплатить джекпот'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
