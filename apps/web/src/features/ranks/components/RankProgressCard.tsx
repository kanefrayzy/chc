import { useTranslations } from 'next-intl';
import { Card, CardBody, CardHeader, Badge } from '@chcgreen/ui';
import type { MyRankProgressDto } from '@/lib/api/ranks';

export interface RankProgressCardProps {
  progress: MyRankProgressDto;
  locale: string;
}

export function RankProgressCard({ progress, locale }: RankProgressCardProps): JSX.Element {
  const t = useTranslations('ranks');
  const total = (Number(progress.totalWageredMinor) / 100).toFixed(2);
  const pct = progress.progressBps / 100;
  const currentName = progress.current
    ? locale === 'az'
      ? progress.current.nameAz
      : progress.current.nameRu
    : '—';
  const nextName = progress.next
    ? locale === 'az'
      ? progress.next.nameAz
      : progress.next.nameRu
    : null;

  return (
    <Card variant="elevated" padding="lg">
      <CardHeader>
        <h3 className="text-lg font-semibold text-text-primary">{t('progress.title')}</h3>
      </CardHeader>
      <CardBody>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-text-muted">{t('progress.current')}</div>
              <div className="mt-1 text-xl font-bold text-text-primary">{currentName}</div>
            </div>
            {nextName ? (
              <div className="text-right">
                <div className="text-xs uppercase tracking-wide text-text-muted">{t('progress.next')}</div>
                <div className="mt-1 text-base font-semibold text-text-secondary">{nextName}</div>
              </div>
            ) : (
              <Badge variant="brand">{t('progress.max')}</Badge>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>{t('progress.wagered')}: {total} AZN</span>
              <span>{pct.toFixed(1)}%</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-bg-elevated">
              <div
                className="h-full bg-brand transition-all"
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
