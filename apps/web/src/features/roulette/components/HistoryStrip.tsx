'use client';

import { useTranslations } from 'next-intl';
import { Card, CardBody, cn } from '@chcgreen/ui';
import type { RouletteRoundDto } from '@/lib/api/roulette';
import { COLOR_DOT_CLASSES } from '../constants';

export interface HistoryStripProps {
  rounds: RouletteRoundDto[];
}

export function HistoryStrip({ rounds }: HistoryStripProps): JSX.Element {
  const t = useTranslations('roulette.history');
  if (rounds.length === 0) {
    return (
      <Card variant="elevated">
        <CardBody className="text-center text-sm text-text-secondary">{t('empty')}</CardBody>
      </Card>
    );
  }
  return (
    <Card variant="elevated">
      <CardBody>
        <div className="flex items-center gap-2 overflow-x-auto">
          {rounds.map((r) => (
            <span
              key={r.id}
              title={r.winningColor ?? undefined}
              className={cn(
                'h-7 w-7 shrink-0 rounded-full',
                r.winningColor ? COLOR_DOT_CLASSES[r.winningColor] : 'bg-bg-elevated',
              )}
            />
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
