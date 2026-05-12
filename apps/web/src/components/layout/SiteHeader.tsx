import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@chcgreen/ui';
import { getServerUser } from '@/lib/api/server';
import { LogoutButton } from '@/features/auth/components/LogoutButton';

export interface SiteHeaderProps {
  locale: string;
}

export async function SiteHeader({ locale }: SiteHeaderProps): Promise<JSX.Element> {
  const t = await getTranslations({ locale, namespace: 'common' });
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? 'CHCGREEN';
  const localePrefix = locale === 'ru' ? '' : `/${locale}`;
  const user = await getServerUser();

  return (
    <header className="flex items-center justify-between border-b border-border pb-6">
      <Link href={`${localePrefix}/`} className="flex items-center gap-3">
        <span className="text-3xl" aria-hidden>
          👑
        </span>
        <span className="text-xl font-bold tracking-wide text-text-primary">{siteName}</span>
      </Link>
      <div className="flex items-center gap-3">
        {user ? (
          <>
            <Link href={`${localePrefix}/profile`}>
              <Button variant="secondary" size="sm">
                @{user.username}
              </Button>
            </Link>
            <LogoutButton redirectTo={`${localePrefix}/`} />
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </header>
  );
}
