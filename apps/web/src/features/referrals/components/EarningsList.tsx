import { useTranslations } from 'next-intl';
import { Card, CardBody, Badge } from '@chcgreen/ui';
import type { ReferralEarningDto } from '@/lib/api/referrals';

const KIND_VARIANT: Record<ReferralEarningDto['kind'], 'success' | 'brand'> = {
  FROM_LOSS: 'success',
  FROM_WIN: 'brand',
};

export interface EarningsListProps {
  items: ReferralEarningDto[];
  locale: string;
}

export function EarningsList({ items, locale }: EarningsListProps): JSX.Element {
  const t = useTranslations('referrals.earnings');
  if (items.length === 0) {
    return (
      <Card variant="elevated">
        <CardBody className="text-center text-sm text-text-secondary">{t('empty')}</CardBody>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((e) => (
        <Card key={e.id} variant="elevated" padding="sm">
          <CardBody>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-text-primary">
                  {e.referredUsername ?? e.referredId.slice(-6)}
                </div>
                <div className="text-xs text-text-muted">
                  {new Date(e.createdAt).toLocaleString(locale === 'az' ? 'az-AZ' : 'ru-RU')}
                </div>
                <div className="mt-1 text-xs text-text-secondary">
                  {t('source')}: {(Number(e.sourceAmountMinor) / 100).toFixed(2)} AZN · {e.rateBps / 100}%
                </div>
              </div>
              <div className="text-right">
                <Badge variant={KIND_VARIANT[e.kind]}>{t(`kind.${e.kind}`)}</Badge>
                <div className="mt-1 text-base font-bold text-success">
                  +{(Number(e.earningMinor) / 100).toFixed(2)} AZN
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
