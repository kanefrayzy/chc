import { useTranslations } from 'next-intl';
import { RankRow } from './RankRow';
import type { RankDto } from '@/lib/api/ranks';

export interface RankListProps {
  ranks: RankDto[];
  locale: string;
  currentRankId?: string | null;
  totalWageredMinor?: string;
}

export function RankList({
  ranks,
  locale,
  currentRankId,
  totalWageredMinor,
}: RankListProps): JSX.Element {
  const t = useTranslations('ranks');
  const total = totalWageredMinor ? BigInt(totalWageredMinor) : null;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-text-primary">{t('all')}</h2>
      <div className="space-y-2">
        {ranks.map((r) => {
          const isCurrent = r.id === currentRankId;
          const isReached = total !== null && BigInt(r.minWageredMinor) <= total;
          return (
            <RankRow
              key={r.id}
              rank={r}
              locale={locale}
              isCurrent={isCurrent}
              isReached={isReached}
            />
          );
        })}
      </div>
    </section>
  );
}
