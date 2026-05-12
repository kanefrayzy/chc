'use client';

import { useTranslations } from 'next-intl';
import { Card, CardBody, Badge, cn } from '@chcgreen/ui';
import type { RouletteBetDto } from '@/lib/api/roulette';
import { COLOR_DOT_CLASSES } from '../constants';

export interface BetsListProps {
  bets: RouletteBetDto[];
  emptyKey?: 'recent' | 'mine';
}

export function BetsList({ bets, emptyKey = 'recent' }: BetsListProps): JSX.Element {
  const t = useTranslations('roulette.bets');
  if (bets.length === 0) {
    return (
      <Card variant="elevated">
        <CardBody className="text-center text-sm text-text-secondary">
          {emptyKey === 'mine' ? t('empty.mine') : t('empty.recent')}
        </CardBody>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {bets.map((b) => (
        <div
          key={b.id}
          className="flex items-center justify-between rounded-lg border border-border bg-bg-card px-3 py-2 text-sm"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn('h-3 w-3 rounded-full shrink-0', COLOR_DOT_CLASSES[b.color])} />
            <span className="truncate text-text-secondary">{b.username ?? '—'}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="tabular-nums text-text-primary">
              {(Number(b.amountMinor) / 100).toFixed(2)} AZN
            </span>
            {b.isWinner ? (
              <Badge variant="success">+{(Number(b.payoutMinor) / 100).toFixed(2)}</Badge>
            ) : Number(b.payoutMinor) > 0 ? null : null}
          </div>
        </div>
      ))}
    </div>
  );
}
