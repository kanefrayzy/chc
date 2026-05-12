'use client';

import { useTranslations } from 'next-intl';
import { Card, CardBody, CardHeader, Badge } from '@chcgreen/ui';
import { CountdownTimer } from './CountdownTimer';
import type { RouletteRoundDto } from '@/lib/api/roulette';

const STATUS_VARIANT: Record<RouletteRoundDto['status'], 'info' | 'warning' | 'success' | 'neutral'> = {
  BETTING: 'info',
  ROLLING: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
};

export interface RoundInfoCardProps {
  round: RouletteRoundDto;
}

export function RoundInfoCard({ round }: RoundInfoCardProps): JSX.Element {
  const t = useTranslations('roulette.round');
  return (
    <Card variant="elevated">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-text-primary">
            {t('title')} <span className="font-mono text-xs text-text-muted">#{round.id.slice(-6)}</span>
          </h3>
          <Badge variant={STATUS_VARIANT[round.status]}>{t(`status.${round.status}`)}</Badge>
        </div>
      </CardHeader>
      <CardBody>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          {round.status === 'BETTING' ? (
            <>
              <dt className="text-text-muted">{t('timeLeft')}</dt>
              <dd className="text-right font-semibold text-text-primary">
                <CountdownTimer endsAt={round.bettingEndsAt} />
              </dd>
            </>
          ) : null}
          <dt className="text-text-muted">{t('serverSeedHash')}</dt>
          <dd className="truncate text-right font-mono text-xs text-text-secondary" title={round.serverSeedHash}>
            {round.serverSeedHash.slice(0, 12)}…
          </dd>
          {round.publicSeed ? (
            <>
              <dt className="text-text-muted">{t('publicSeed')}</dt>
              <dd className="truncate text-right font-mono text-xs text-text-secondary" title={round.publicSeed}>
                {round.publicSeed.slice(0, 12)}…
              </dd>
            </>
          ) : null}
          {round.serverSeed ? (
            <>
              <dt className="text-text-muted">{t('serverSeed')}</dt>
              <dd className="truncate text-right font-mono text-xs text-text-secondary" title={round.serverSeed}>
                {round.serverSeed.slice(0, 12)}…
              </dd>
            </>
          ) : null}
        </dl>
      </CardBody>
    </Card>
  );
}
