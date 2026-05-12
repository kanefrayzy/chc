import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@chcgreen/ui';

export interface SiteHeaderProps {
  locale: string;
}

export function SiteHeader({ locale }: SiteHeaderProps): JSX.Element {
  const t = useTranslations('common');
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? 'CHCGREEN';
  const localePrefix = locale === 'ru' ? '' : `/${locale}`;

  return (
    <header className="flex items-center justify-between border-b border-border pb-6">
      <Link href={`${localePrefix}/`} className="flex items-center gap-3">
        <span className="text-3xl" aria-hidden>
          👑
        </span>
        <span className="text-xl font-bold tracking-wide text-text-primary">{siteName}</span>
      </Link>
      <div className="flex items-center gap-3">
        <Link href={`${localePrefix}/login`}>
          <Button variant="secondary" size="sm">
            {t('login')}
          </Button>
        </Link>
        <Link href={`${localePrefix}/register`}>
          <Button variant="primary" size="sm">
            {t('register')}
          </Button>
        </Link>
      </div>
    </header>
  );
}
