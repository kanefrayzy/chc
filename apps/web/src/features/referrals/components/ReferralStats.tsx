import { useTranslations } from 'next-intl';
import { Card, CardBody } from '@chcgreen/ui';

export interface ReferralStatsProps {
  referralsCount: number;
  totalEarningsMinor: string;
}

export function ReferralStats({
  referralsCount,
  totalEarningsMinor,
}: ReferralStatsProps): JSX.Element {
  const t = useTranslations('referrals.stats');
  const totalAzn = (Number(totalEarningsMinor) / 100).toFixed(2);
  return (
    <div className="grid grid-cols-2 gap-3">
      <Card variant="elevated" padding="md">
        <CardBody>
          <div className="text-xs uppercase tracking-wide text-text-muted">{t('referrals')}</div>
          <div className="mt-1 text-2xl font-bold text-text-primary">{referralsCount}</div>
        </CardBody>
      </Card>
      <Card variant="elevated" padding="md">
        <CardBody>
          <div className="text-xs uppercase tracking-wide text-text-muted">{t('totalEarned')}</div>
          <div className="mt-1 text-2xl font-bold text-text-primary">{totalAzn} AZN</div>
        </CardBody>
      </Card>
    </div>
  );
}
