'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  adminApi,
  type AdminDepositRow,
  type AdminDepositStat,
  type DepositStatus,
} from '../../../lib/api/admin';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { DataTable } from '../../../components/ui/DataTable';
import { minorToAzn, formatDateTime, shortId } from '../../../lib/format';
import { cn } from '../../../lib/cn';

const STATUS_TONE: Record<
  DepositStatus,
  'neutral' | 'info' | 'warning' | 'success' | 'danger'
> = {
  PENDING: 'warning',
  PROCESSING: 'info',
  COMPLETED: 'success',
  FAILED: 'danger',
  EXPIRED: 'neutral',
  CANCELLED: 'neutral',
};

const STATUS_LABEL: Record<DepositStatus, string> = {
  PENDING: 'Ожидает оплаты',
  PROCESSING: 'В обработке',
  COMPLETED: 'Зачислен',
  FAILED: 'Ошибка',
  EXPIRED: 'Истёк',
  CANCELLED: 'Отменён',
};

const TABS: { value: string; label: string }[] = [
  { value: '', label: 'Все' },
  { value: 'PENDING', label: 'Ожидают' },
  { value: 'COMPLETED', label: 'Зачислены' },
  { value: 'EXPIRED', label: 'Истёкшие' },
  { value: 'FAILED', label: 'Ошибки' },
];

const PROVIDER_LABEL: Record<AdminDepositRow['provider'], string> = {
  BETATRANSFER: 'Betatransfer',
  WESTWALLET: 'WestWallet',
};

export function TransactionsTable({
  initialItems,
  initialStats,
  status,
}: {
  initialItems: AdminDepositRow[];
  initialStats: AdminDepositStat[];
  status: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const [items, setItems] = useState(initialItems);
  const [stats, setStats] = useState(initialStats);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(
    async (nextStatus: string, term: string) => {
      setLoading(true);
      try {
        const [page, s] = await Promise.all([
          adminApi.deposits.list({
            ...(nextStatus ? { status: nextStatus } : {}),
            ...(term.trim() ? { search: term.trim() } : {}),
            limit: 50,
          }),
          adminApi.deposits.stats().catch(() => ({ items: stats })),
        ]);
        setItems(page.items);
        setStats(s.items);
      } finally {
        setLoading(false);
      }
    },
    [stats],
  );

  // Смена вкладки правит только query — данные забираем сами
  const mounted = useRef(status);
  useEffect(() => {
    if (mounted.current === status) return;
    mounted.current = status;
    void load(status, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function setStatus(next: string) {
    const usp = new URLSearchParams(params);
    if (next) usp.set('status', next);
    else usp.delete('status');
    router.replace(`?${usp.toString()}`);
  }

  async function copy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* значение всегда можно выделить вручную */
    }
  }

  const statMap = new Map(stats.map((s) => [s.status, s]));

  return (
    <div className="space-y-4">
      {/* Сводка по статусам */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(['COMPLETED', 'PENDING', 'EXPIRED', 'FAILED'] as DepositStatus[]).map((s) => {
          const row = statMap.get(s);
          return (
            <Card key={s}>
              <div className="text-[11px] uppercase tracking-wide text-ink-400">
                {STATUS_LABEL[s]}
              </div>
              <div className="mt-1 font-mono text-xl font-bold tabular-nums text-ink-900">
                {row?.count ?? 0}
              </div>
              <div className="text-xs text-ink-500">
                {minorToAzn(row?.totalMinor ?? '0')} AZN
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center rounded-md border border-border bg-page p-0.5">
            {TABS.map((tab) => (
              <button
                key={tab.value || 'all'}
                type="button"
                onClick={() => setStatus(tab.value)}
                className={cn(
                  'rounded px-3 py-1 text-xs font-medium transition-colors',
                  status === tab.value
                    ? 'bg-surface text-ink-900 shadow-card'
                    : 'text-ink-500 hover:text-ink-900',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void load(status, search);
              }}
              placeholder="ID, игрок, карта…"
              className="w-56 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-ink-900 outline-none focus:border-primary"
            />
            <Button size="sm" variant="ghost" onClick={() => void load(status, search)}>
              Найти
            </Button>
          </div>
        </div>

        <DataTable
          rows={loading ? [] : items}
          empty={loading ? 'Загружаем…' : 'Нет транзакций'}
          columns={[
            {
              key: 'id',
              header: 'Заявка',
              cell: (d) => (
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                  className="font-mono text-xs text-primary hover:underline"
                >
                  {shortId(d.id)}
                </button>
              ),
            },
            {
              key: 'user',
              header: 'Игрок',
              cell: (d) => <span className="text-sm text-ink-900">{d.username ?? '—'}</span>,
            },
            {
              key: 'method',
              header: 'Метод',
              cell: (d) => (
                <div>
                  <div className="text-sm text-ink-700">{d.methodName ?? '—'}</div>
                  <div className="text-[11px] text-ink-400">{PROVIDER_LABEL[d.provider]}</div>
                </div>
              ),
            },
            {
              key: 'amount',
              header: 'Сумма',
              align: 'right',
              cell: (d) => (
                <div>
                  <div className="font-mono font-semibold tabular-nums text-ink-900">
                    {minorToAzn(d.amountMinor)}
                  </div>
                  {d.originalAmount && d.originalCurrency !== 'AZN' && (
                    <div className="text-[11px] text-ink-400">
                      {d.originalAmount} {d.originalCurrency}
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'providerId',
              header: 'ID у провайдера',
              cell: (d) =>
                d.providerId ? (
                  <button
                    type="button"
                    onClick={() => void copy(d.providerId!, d.id)}
                    title="Скопировать"
                    className="font-mono text-xs text-ink-700 hover:text-primary"
                  >
                    {copied === d.id ? 'Скопировано' : d.providerId}
                  </button>
                ) : (
                  <span className="text-xs text-ink-400">—</span>
                ),
            },
            {
              key: 'requisite',
              header: 'Реквизит',
              cell: (d) => (
                <div>
                  <div className="font-mono text-xs text-ink-700">{d.requisite ?? '—'}</div>
                  {d.requisiteBank && (
                    <div className="text-[11px] text-ink-400">{d.requisiteBank}</div>
                  )}
                </div>
              ),
            },
            {
              key: 'status',
              header: 'Статус',
              cell: (d) => <Badge tone={STATUS_TONE[d.status]}>{STATUS_LABEL[d.status]}</Badge>,
            },
            {
              key: 'created',
              header: 'Создана',
              cell: (d) => (
                <span className="text-sm text-ink-500">{formatDateTime(d.createdAt)}</span>
              ),
            },
          ]}
          renderDetail={(d) =>
            expanded === d.id ? (
              <div className="rounded-lg border border-border bg-surface p-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Info label="ID заявки" value={d.id} />
                  <Info label="ID у провайдера" value={d.providerId ?? 'не присвоен'} />
                  <Info label="Карта для перевода" value={d.requisite ?? '—'} />
                  <Info label="Банк" value={d.requisiteBank ?? '—'} />
                  <Info label="Получатель" value={d.requisiteOwner ?? '—'} />
                  <Info
                    label="Действует до"
                    value={d.expiresAt ? formatDateTime(d.expiresAt) : '—'}
                  />
                  <Info
                    label="Зачислена"
                    value={d.completedAt ? formatDateTime(d.completedAt) : '—'}
                  />
                  {d.paymentUrl && <Info label="Ссылка на оплату" value={d.paymentUrl} />}
                </div>
              </div>
            ) : null
          }
        />
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-ink-400">{label}</div>
      <div className="break-all font-mono text-xs text-ink-900">{value}</div>
    </div>
  );
}
