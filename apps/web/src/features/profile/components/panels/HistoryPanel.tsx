'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, Spinner, Badge } from '@chcgreen/ui';
import { depositsApi, type DepositDto } from '@/lib/api/deposits';
import { withdrawalsApi, type WithdrawalDto } from '@/lib/api/withdrawals';
import { codePurchasesApi, type CodePurchaseDto } from '@/lib/api/code-purchases';
import { ApiException } from '@/lib/api/client';

type Row =
  | { kind: 'deposit'; row: DepositDto }
  | { kind: 'withdrawal'; row: WithdrawalDto }
  | { kind: 'code'; row: CodePurchaseDto };

function rowDate(r: Row): number {
  return new Date(r.row.createdAt).getTime();
}

function formatAzn(minor: string): string {
  const n = Number(BigInt(minor)) / 100;
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusTone(status: string): 'neutral' | 'info' | 'success' | 'danger' | 'purple' {
  if (status === 'COMPLETED' || status === 'CODE_ISSUED') return 'success';
  if (status === 'PENDING' || status === 'PROCESSING' || status === 'AWAITING_MODERATOR')
    return 'info';
  if (status === 'CANCELLED' || status === 'FAILED' || status === 'REJECTED' || status === 'EXPIRED')
    return 'danger';
  return 'neutral';
}

export function HistoryPanel({ locale }: { locale: string }): JSX.Element {
  const t = useTranslations('profile.history');
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      depositsApi.list({ limit: 30 }).catch(() => ({ items: [] as DepositDto[] })),
      withdrawalsApi.list({ limit: 30 }).catch(() => ({ items: [] as WithdrawalDto[] })),
      codePurchasesApi.list({ limit: 30 }).catch(() => ({ items: [] as CodePurchaseDto[] })),
    ])
      .then(([d, w, c]) => {
        if (cancelled) return;
        const merged: Row[] = [
          ...d.items.map((r) => ({ kind: 'deposit' as const, row: r })),
          ...w.items.map((r) => ({ kind: 'withdrawal' as const, row: r })),
          ...c.items.map((r) => ({ kind: 'code' as const, row: r })),
        ].sort((a, b) => rowDate(b) - rowDate(a));
        setRows(merged);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof ApiException ? e.message : t('errors.loadFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  if (error) return <Alert variant="danger">{error}</Alert>;

  if (rows.length === 0) {
    return <p className="text-sm text-text-secondary">{t('empty')}</p>;
  }

  const fmt = new Intl.DateTimeFormat(locale === 'az' ? 'az-AZ' : 'ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-bg-elevated text-xs uppercase tracking-wider text-text-secondary">
          <tr>
            <th className="px-3 py-2 text-left">{t('cols.date')}</th>
            <th className="px-3 py-2 text-left">{t('cols.type')}</th>
            <th className="px-3 py-2 text-right">{t('cols.amount')}</th>
            <th className="px-3 py-2 text-left">{t('cols.status')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-bg-surface">
          {rows.map((r) => {
            const id = r.row.id;
            const date = fmt.format(new Date(r.row.createdAt));
            let label: string;
            let sign = '';
            if (r.kind === 'deposit') {
              label = t('types.deposit');
              sign = '+';
            } else if (r.kind === 'withdrawal') {
              label = t('types.withdrawal');
              sign = '−';
            } else {
              label = t('types.code');
              sign = '−';
            }
            return (
              <tr key={`${r.kind}-${id}`}>
                <td className="px-3 py-2 text-text-secondary">{date}</td>
                <td className="px-3 py-2 text-text-primary">{label}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {sign}
                  {formatAzn(r.row.amountMinor)} AZN
                </td>
                <td className="px-3 py-2">
                  <Badge variant={statusTone(r.row.status)}>{r.row.status}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
