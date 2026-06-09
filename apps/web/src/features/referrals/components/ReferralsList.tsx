import { useTranslations } from 'next-intl';
import { Card, CardBody } from '@chcgreen/ui';
import type { ReferralUserDto } from '@/lib/api/referrals';

export interface ReferralsListProps {
  items: ReferralUserDto[];
  locale: string;
}

export function ReferralsList({ items, locale }: ReferralsListProps): JSX.Element {
  const t = useTranslations('referrals.list');
  if (items.length === 0) {
    return (
      <Card variant="elevated">
        <CardBody className="text-center text-sm text-text-secondary">{t('empty')}</CardBody>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((r) => (
        <Card key={r.id} variant="elevated" padding="sm">
          <CardBody>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-text-primary">{r.username}</div>
                <div className="mt-0.5 text-xs text-text-muted" suppressHydrationWarning>
                  {t('joined')}: {new Date(r.createdAt).toLocaleDateString(locale === 'az' ? 'az-AZ' : 'ru-RU')}
                </div>
                <div className="mt-1 text-xs text-text-secondary">
                  {t('wagered')}: {(Number(r.totalWageredMinor) / 100).toFixed(2)} AZN
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-text-muted">{t('earned')}</div>
                <div className="mt-1 text-base font-bold text-success">
                  +{(Number(r.earnedFromMinor) / 100).toFixed(2)} AZN
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
