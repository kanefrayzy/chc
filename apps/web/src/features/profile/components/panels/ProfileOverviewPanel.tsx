import { Card } from '@chcgreen/ui';
import { useTranslations } from 'next-intl';

export function ProfileOverviewPanel(): JSX.Element {
  const t = useTranslations('profile.overview');
  return (
    <Card padding="lg">
      <h3 className="text-lg font-semibold text-text-primary">{t('title')}</h3>
      <p className="mt-2 text-sm text-text-secondary">{t('placeholder')}</p>
    </Card>
  );
}
