import { Card } from '@chcgreen/ui';
import { useTranslations } from 'next-intl';

export interface ReferralsPanelProps {
  referralCode: string;
}

export function ReferralsPanel({ referralCode }: ReferralsPanelProps): JSX.Element {
  const t = useTranslations('profile.referrals');
  const link =
    typeof window === 'undefined'
      ? `?ref=${referralCode}`
      : `${window.location.origin}/register?ref=${referralCode}`;

  return (
    <Card padding="lg">
      <h3 className="text-lg font-semibold text-text-primary">{t('title')}</h3>
      <p className="mt-2 text-sm text-text-secondary">{t('description')}</p>
      <div className="mt-4">
        <div className="text-xs uppercase tracking-wider text-text-secondary">
          {t('codeLabel')}
        </div>
        <div className="mt-1 font-mono text-lg text-text-primary">{referralCode}</div>
      </div>
      <div className="mt-4">
        <div className="text-xs uppercase tracking-wider text-text-secondary">
          {t('linkLabel')}
        </div>
        <div className="mt-1 break-all rounded-md border border-border bg-bg-base px-3 py-2 font-mono text-sm text-text-primary">
          {link}
        </div>
      </div>
    </Card>
  );
}
