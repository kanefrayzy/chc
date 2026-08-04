'use client';

import { useTranslations } from 'next-intl';
import type { MinesGameDto } from '@/lib/api/mines';

export interface MinesHistoryProps {
  items: MinesGameDto[];
}

export function MinesHistory({ items }: MinesHistoryProps): JSX.Element {
  const t = useTranslations('mines.history');
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-bg-card p-4 text-sm text-text-muted">
        {t('empty')}
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-border bg-bg-card">
      <div className="border-b border-border px-4 py-3 text-sm font-semibold text-text-primary">{t('title')}</div>
      <ul className="divide-y divide-border">
        {items.slice(0, 12).map((g) => {
          const bet = Number(g.betMinor) / 100;
          const win = Number(g.payoutMinor) / 100;
          const net = win - bet;
          const won = g.status === 'CASHED_OUT' && net > 0;
          return (
            <li key={g.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <div className="flex items-center gap-2">
                <span className={won ? 'text-brand' : g.status === 'BUSTED' ? 'text-danger' : 'text-text-muted'}>
                  {g.status === 'BUSTED' ? '−' : won ? '+' : '·'}
                </span>
                <span className="font-mono text-xs text-text-muted">{g.mineCount} {t('minesShort')}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-text-muted">−{bet.toFixed(2)}</span>
                <span className={`font-mono text-xs font-semibold ${won ? 'text-brand' : 'text-text-muted'}`}>
                  {won ? `+${win.toFixed(2)}` : '0.00'}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
