'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, Spinner } from '@chcgreen/ui';
import { depositsApi, type DepositDto } from '@/lib/api/deposits';
import { withdrawalsApi, type WithdrawalDto } from '@/lib/api/withdrawals';
import { codePurchasesApi, type CodePurchaseDto } from '@/lib/api/code-purchases';
import { ApiException } from '@/lib/api/client';

type Kind = 'deposit' | 'withdrawal' | 'code';
type Filter = 'all' | Kind;

type Row =
  | { kind: 'deposit'; row: DepositDto }
  | { kind: 'withdrawal'; row: WithdrawalDto }
  | { kind: 'code'; row: CodePurchaseDto };

/** Цвет статуса: успех / в работе / неудача. */
function statusTone(status: string): string {
  if (status === 'COMPLETED' || status === 'CODE_ISSUED')
    return 'bg-brand/15 text-brand';
  if (status === 'PENDING' || status === 'PROCESSING' || status === 'AWAITING_MODERATOR')
    return 'bg-info/15 text-info';
  return 'bg-danger/15 text-danger';
}

function formatAzn(minor: string): string {
  const n = Number(BigInt(minor)) / 100;
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function rowDate(r: Row): number {
  return new Date(r.row.createdAt).getTime();
}

const PAGE = 15;

export function HistoryPanel({ locale }: { locale: string }): JSX.Element {
  const t = useTranslations('profile.history');
  const lang = locale === 'az' ? 'az' : 'ru';

  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      depositsApi.list({ limit: 50 }).catch(() => ({ items: [] as DepositDto[] })),
      withdrawalsApi.list({ limit: 50 }).catch(() => ({ items: [] as WithdrawalDto[] })),
      codePurchasesApi.list({ limit: 50 }).catch(() => ({ items: [] as CodePurchaseDto[] })),
    ])
      .then(([d, w, c]) => {
        if (cancelled) return;
        setRows(
          [
            ...d.items.map((r) => ({ kind: 'deposit' as const, row: r })),
            ...w.items.map((r) => ({ kind: 'withdrawal' as const, row: r })),
            ...c.items.map((r) => ({ kind: 'code' as const, row: r })),
          ].sort((a, b) => rowDate(b) - rowDate(a)),
        );
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiException ? e.message : t('errors.loadFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const counts = useMemo(() => {
    const c = { all: rows.length, deposit: 0, withdrawal: 0, code: 0 };
    for (const r of rows) c[r.kind] += 1;
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const filtered = filter === 'all' ? rows : rows.filter((r) => r.kind === filter);
    return filtered.slice(0, shown);
  }, [rows, filter, shown]);

  const totalFiltered = filter === 'all' ? rows.length : counts[filter];

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }
  if (error) return <Alert variant="danger">{error}</Alert>;

  const fmt = new Intl.DateTimeFormat(lang === 'az' ? 'az-AZ' : 'ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  /** Известные статусы переводим, неизвестный показываем как есть. */
  function statusLabel(status: string): string {
    const known = [
      'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED',
      'REJECTED', 'CANCELLED', 'AWAITING_MODERATOR', 'CODE_ISSUED',
    ];
    return known.includes(status) ? t(`status.${status}`) : status;
  }

  /** Способ: банк/карта для пополнений, карта или крипта для выводов. */
  function methodOf(r: Row): string | null {
    if (r.kind === 'deposit') {
      const d = r.row;
      return d.requisiteDetails?.bank ?? t(d.provider === 'WESTWALLET' ? 'method.crypto' : 'method.card');
    }
    if (r.kind === 'withdrawal') {
      // Название платёжки, а не агрегатора, через который проходит выплата
      return (
        r.row.methodName ??
        t(r.row.destination?.kind === 'crypto' ? 'method.crypto' : 'method.card')
      );
    }
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Фильтры по типу операции */}
      <div className="flex flex-wrap gap-1.5">
        {(['all', 'deposit', 'withdrawal', 'code'] as const).map((f) => {
          const active = f === filter;
          const count = counts[f];
          return (
            <button
              key={f}
              type="button"
              onClick={() => {
                setFilter(f);
                setShown(PAGE);
              }}
              aria-pressed={active}
              className={[
                'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                active
                  ? 'border-brand/50 bg-brand/10 text-brand'
                  : 'border-border bg-bg-card text-text-secondary hover:border-border-strong hover:text-text-primary',
              ].join(' ')}
            >
              {t(`filters.${f}`)}
              {count > 0 && <span className="ml-1.5 opacity-60">{count}</span>}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">{t('empty')}</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-bg-card">
          {visible.map((r) => {
            const isIncome = r.kind === 'deposit';
            const method = methodOf(r);
            return (
              <li
                key={`${r.kind}-${r.row.id}`}
                className="flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-bg-card-hover"
              >
                <span
                  aria-hidden
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base ${
                    isIncome ? 'bg-brand/10 text-brand' : 'bg-accent-purple/10 text-accent-purple'
                  }`}
                >
                  {isIncome ? '↓' : '↑'}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text-primary">
                    {t(`types.${r.kind}`)}
                    {method && <span className="ml-1.5 font-normal text-text-muted">· {method}</span>}
                  </p>
                  <p className="mt-0.5 text-[11px] text-text-muted" suppressHydrationWarning>
                    {fmt.format(new Date(r.row.createdAt))}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p
                    className={`font-mono text-sm font-bold tabular-nums ${
                      isIncome ? 'text-brand' : 'text-text-primary'
                    }`}
                  >
                    {isIncome ? '+' : '−'}
                    {formatAzn(r.row.amountMinor)}
                  </p>
                  <span
                    className={`mt-0.5 inline-block rounded px-1.5 py-px text-[10px] font-semibold ${statusTone(
                      r.row.status,
                    )}`}
                  >
                    {statusLabel(r.row.status)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {totalFiltered > shown && (
        <button
          type="button"
          onClick={() => setShown((s) => s + PAGE)}
          className="w-full rounded-xl border border-border bg-bg-card py-2.5 text-xs font-semibold text-text-secondary transition-colors hover:border-brand/40 hover:text-brand"
        >
          {t('more')}
        </button>
      )}
    </div>
  );
}
