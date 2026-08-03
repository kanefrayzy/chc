'use client';

import { useMemo, useState } from 'react';
import type { ReferralSummaryDto, ReferralUserDto } from '@/lib/api/referrals';

type SortKey = 'date' | 'deposits' | 'earned';

function formatAzn(minor: string): string {
  const value = BigInt(minor);
  const major = value / 100n;
  const frac = (value % 100n).toString().padStart(2, '0');
  return `${major.toLocaleString('ru-RU')},${frac}`;
}

function formatWhole(minor: string): string {
  return (BigInt(minor) / 100n).toLocaleString('ru-RU');
}

function pct(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;
}

interface StatProps {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  accent?: 'brand' | 'info' | 'warning' | 'default';
  icon: string;
}

const ACCENT: Record<NonNullable<StatProps['accent']>, string> = {
  brand: 'text-brand',
  info: 'text-info',
  warning: 'text-warning',
  default: 'text-text-primary',
};

function StatCard({ label, value, unit, hint, accent = 'default', icon }: StatProps): JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-bg-card p-4 transition-colors hover:border-border-strong">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        <span aria-hidden>{icon}</span>
        {label}
      </div>
      <div className={`mt-2 font-mono text-2xl font-black tabular-nums ${ACCENT[accent]}`}>
        {value}
        {unit && <span className="ml-1 text-sm font-bold text-text-muted">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-[11px] text-text-muted">{hint}</div>}
    </div>
  );
}

export interface ReferralDashboardProps {
  summary: ReferralSummaryDto;
  referrals: ReferralUserDto[];
  shareUrl: string;
  locale: string;
}

export function ReferralDashboard({
  summary,
  referrals,
  shareUrl,
  locale,
}: ReferralDashboardProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const [sort, setSort] = useState<SortKey>('date');
  const [desc, setDesc] = useState(true);

  const conversion =
    summary.referralsCount > 0
      ? Math.round((summary.ftdCount / summary.referralsCount) * 100)
      : 0;

  const sorted = useMemo(() => {
    const list = [...referrals];
    list.sort((a, b) => {
      let diff = 0;
      if (sort === 'date') {
        diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sort === 'deposits') {
        const d = BigInt(a.depositsMinor) - BigInt(b.depositsMinor);
        diff = d > 0n ? 1 : d < 0n ? -1 : 0;
      } else {
        const d = BigInt(a.earnedFromMinor) - BigInt(b.earnedFromMinor);
        diff = d > 0n ? 1 : d < 0n ? -1 : 0;
      }
      return desc ? -diff : diff;
    });
    return list;
  }, [referrals, sort, desc]);

  function toggleSort(key: SortKey): void {
    if (sort === key) {
      setDesc((v) => !v);
    } else {
      setSort(key);
      setDesc(true);
    }
  }

  async function copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* буфер недоступен — ссылку всегда можно выделить вручную */
    }
  }

  const dateFmt = new Intl.DateTimeFormat(locale === 'az' ? 'az-AZ' : 'ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const sortArrow = (key: SortKey): string => (sort === key ? (desc ? ' ↓' : ' ↑') : ' ↕');

  return (
    <div className="space-y-4">
      {/* Показатели */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          icon="👥"
          label="Рефералов"
          value={String(summary.referralsCount)}
          hint="Всего по вашей ссылке"
        />
        <StatCard
          icon="💳"
          label="С депозитом"
          value={String(summary.ftdCount)}
          hint={`Конверсия ${conversion}%`}
          accent="info"
        />
        <StatCard
          icon="📈"
          label="Заработано"
          value={formatAzn(summary.totalEarningsMinor)}
          unit="AZN"
          hint="Зачислено на баланс"
          accent="brand"
        />
        <StatCard
          icon="💰"
          label="Их депозиты"
          value={formatWhole(summary.depositsMinor)}
          unit="AZN"
          hint={`${summary.depositsCount} ${summary.depositsCount === 1 ? 'пополнение' : 'пополнений'}`}
        />
        <StatCard
          icon="🎲"
          label="Их оборот"
          value={formatWhole(summary.wageredMinor)}
          unit="AZN"
          hint="Сумма всех ставок"
        />
        <StatCard
          icon="%"
          label="Ваша ставка"
          value={pct(summary.rates.fromDepositBps)}
          hint={`и ${pct(summary.rates.fromLossBps)} от проигрыша`}
          accent="warning"
        />
      </div>

      {/* Ссылка */}
      <div className="rounded-xl border border-border bg-bg-card p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          Ваша реферальная ссылка
        </div>
        <p className="mt-1 text-xs text-text-secondary">
          Приглашайте игроков и получайте {pct(summary.rates.fromDepositBps)} с каждого их
          пополнения и {pct(summary.rates.fromLossBps)} с проигрыша.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={shareUrl}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Реферальная ссылка"
            className="min-w-0 flex-1 rounded-lg border border-border bg-bg-elevated px-3 py-2.5 font-mono text-sm text-text-secondary outline-none focus:border-brand/50"
          />
          <button
            type="button"
            onClick={() => void copyLink()}
            className="shrink-0 rounded-lg bg-brand px-5 py-2.5 text-sm font-bold text-bg-base transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            {copied ? '✓ Скопировано' : 'Копировать'}
          </button>
        </div>
        <div className="mt-2 text-[11px] text-text-muted">
          Код приглашения: <span className="font-mono text-text-secondary">{summary.referralCode}</span>
        </div>
      </div>

      {/* Таблица рефералов */}
      <div className="overflow-hidden rounded-xl border border-border bg-bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-bold text-text-primary">Ваши рефералы</h2>
        </div>

        {sorted.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-text-muted">
            Пока никто не зарегистрировался по вашей ссылке
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-text-muted">
                  <th className="px-4 py-2.5 text-left font-semibold">Игрок</th>
                  <th className="px-4 py-2.5 text-left font-semibold">
                    <button type="button" onClick={() => toggleSort('date')} className="hover:text-text-secondary">
                      Регистрация{sortArrow('date')}
                    </button>
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold">
                    <button type="button" onClick={() => toggleSort('deposits')} className="hover:text-text-secondary">
                      Депозиты{sortArrow('deposits')}
                    </button>
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold">
                    <button type="button" onClick={() => toggleSort('earned')} className="hover:text-text-secondary">
                      Ваш доход{sortArrow('earned')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((r) => {
                  const earned = BigInt(r.earnedFromMinor);
                  return (
                    <tr key={r.id} className="transition-colors hover:bg-bg-card-hover">
                      <td className="px-4 py-3 font-medium text-text-primary">{r.username}</td>
                      <td className="px-4 py-3 text-text-muted" suppressHydrationWarning>
                        {dateFmt.format(new Date(r.createdAt))}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-text-secondary">
                        {formatAzn(r.depositsMinor)}
                        {r.depositsCount > 0 && (
                          <span className="ml-1 text-[11px] text-text-muted">
                            ×{r.depositsCount}
                          </span>
                        )}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono font-semibold tabular-nums ${
                          earned > 0n ? 'text-brand' : 'text-text-muted'
                        }`}
                      >
                        +{formatAzn(r.earnedFromMinor)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
