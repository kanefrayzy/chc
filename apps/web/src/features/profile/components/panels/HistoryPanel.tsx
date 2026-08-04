'use client';

import { useEffect, useMemo, useState } from 'react';
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

/** Понятные статусы вместо технических кодов вроде COMPLETED / AWAITING_MODERATOR. */
const STATUS_RU: Record<string, string> = {
  PENDING: 'Ожидает оплаты',
  PROCESSING: 'В обработке',
  COMPLETED: 'Выполнено',
  FAILED: 'Не удалось',
  EXPIRED: 'Истёк срок',
  REJECTED: 'Отклонено',
  CANCELLED: 'Отменено',
  AWAITING_MODERATOR: 'Ждёт модератора',
  CODE_ISSUED: 'Код выдан',
};

const STATUS_AZ: Record<string, string> = {
  PENDING: 'Ödəniş gözlənilir',
  PROCESSING: 'İşlənir',
  COMPLETED: 'Tamamlandı',
  FAILED: 'Alınmadı',
  EXPIRED: 'Vaxtı bitdi',
  REJECTED: 'İmtina edildi',
  CANCELLED: 'Ləğv edildi',
  AWAITING_MODERATOR: 'Moderator gözləyir',
  CODE_ISSUED: 'Kod verildi',
};

const LABELS = {
  ru: {
    filters: { all: 'Все', deposit: 'Пополнения', withdrawal: 'Выводы', code: 'Коды' },
    types: { deposit: 'Пополнение', withdrawal: 'Вывод', code: 'Покупка кода' },
    empty: 'Пока нет операций',
    error: 'Не удалось загрузить историю',
    more: 'Показать ещё',
    card: 'Карта',
    crypto: 'Криптовалюта',
  },
  az: {
    filters: { all: 'Hamısı', deposit: 'Balans artırma', withdrawal: 'Çıxarışlar', code: 'Kodlar' },
    types: { deposit: 'Balans artırma', withdrawal: 'Çıxarış', code: 'Kod alışı' },
    empty: 'Hələ əməliyyat yoxdur',
    error: 'Tarixçəni yükləmək alınmadı',
    more: 'Daha çox',
    card: 'Kart',
    crypto: 'Kriptovalyuta',
  },
} as const;

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
  const lang = locale === 'az' ? 'az' : 'ru';
  const L = LABELS[lang];
  const statusMap = lang === 'az' ? STATUS_AZ : STATUS_RU;

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
        if (!cancelled) setError(e instanceof ApiException ? e.message : L.error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [L.error]);

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

  /** Способ: банк/карта для пополнений, карта или крипта для выводов. */
  function methodOf(r: Row): string | null {
    if (r.kind === 'deposit') {
      const d = r.row;
      return d.requisiteDetails?.bank ?? (d.provider === 'WESTWALLET' ? L.crypto : L.card);
    }
    if (r.kind === 'withdrawal') {
      // Название платёжки, а не агрегатора, через который проходит выплата
      return r.row.methodName ?? (r.row.destination?.kind === 'crypto' ? L.crypto : L.card);
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
              {L.filters[f]}
              {count > 0 && <span className="ml-1.5 opacity-60">{count}</span>}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">{L.empty}</p>
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
                    {L.types[r.kind]}
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
                    {statusMap[r.row.status] ?? r.row.status}
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
          {L.more}
        </button>
      )}
    </div>
  );
}
