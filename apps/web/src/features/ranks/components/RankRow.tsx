import { useTranslations } from 'next-intl';
import { Card, CardBody, Badge } from '@chcgreen/ui';
import type { RankDto } from '@/lib/api/ranks';

export interface RankRowProps {
  rank: RankDto;
  locale: string;
  isCurrent?: boolean;
  isReached?: boolean;
}

export function RankRow({ rank, locale, isCurrent, isReached }: RankRowProps): JSX.Element {
  const t = useTranslations('ranks');
  const name = locale === 'az' ? rank.nameAz : rank.nameRu;
  const minAzn = (Number(rank.minWageredMinor) / 100).toFixed(2);
  return (
    <Card
      variant="elevated"
      padding="md"
      className={isCurrent ? 'border-2 border-brand' : undefined}
    >
      <CardBody>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-bg-elevated text-lg font-bold text-text-primary">
              {rank.order}
            </div>
            <div>
              <div className="text-base font-semibold text-text-primary">{name}</div>
              <div className="text-xs text-text-muted">
                {t('threshold')}: {minAzn} AZN
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {isCurrent && <Badge variant="brand">{t('current')}</Badge>}
            {!isCurrent && isReached && <Badge variant="success">{t('reached')}</Badge>}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
