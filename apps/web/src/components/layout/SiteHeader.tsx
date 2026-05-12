import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@chcgreen/ui';
import { getServerUser } from '@/lib/api/server';
import { getPublicSettings } from '@/lib/api/settings';
import { LogoutButton } from '@/features/auth/components/LogoutButton';
import { SiteNav, type NavItem } from './SiteNav';

export interface SiteHeaderProps {
  locale: string;
}

export async function SiteHeader({ locale }: SiteHeaderProps): Promise<JSX.Element> {
  const t = await getTranslations({ locale, namespace: 'common' });
  const tNav = await getTranslations({ locale, namespace: 'nav' });
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? 'CHCGREEN';
  const localePrefix = locale === 'ru' ? '' : `/${locale}`;
  const [user, settings] = await Promise.all([getServerUser(), getPublicSettings()]);

  const guestNav: NavItem[] = [];
  if (settings['gameplay.roulette_enabled']) {
    guestNav.push({ href: '/roulette', label: tNav('roulette') });
  }
  if (settings['gameplay.ranks_enabled']) {
    guestNav.push({ href: '/ranks', label: tNav('ranks') });
  }

  const authNav: NavItem[] = [];
  if (settings['gameplay.roulette_enabled']) {
    authNav.push({ href: '/roulette', label: tNav('roulette') });
  }
  if (settings['gameplay.chat_enabled']) {
    authNav.push({ href: '/chat', label: tNav('chat') });
  }
  if (settings['gameplay.referrals_enabled']) {
    authNav.push({ href: '/referrals', label: tNav('referral') });
  }
  if (settings['gameplay.ranks_enabled']) {
    authNav.push({ href: '/ranks', label: tNav('ranks') });
  }
  authNav.push({ href: '/deposit', label: tNav('deposit') });
  authNav.push({ href: '/withdraw', label: tNav('withdraw') });

  return (
    <header className="flex items-center justify-between gap-6 border-b border-border pb-6">
      <div className="flex items-center gap-8 min-w-0">
        <Link href={`${localePrefix}/`} className="flex items-center gap-3 shrink-0">
          <span className="text-3xl" aria-hidden>
            👑
          </span>
          <span className="text-xl font-bold tracking-wide text-text-primary">{siteName}</span>
        </Link>
        <SiteNav items={user ? authNav : guestNav} localePrefix={localePrefix} />
      </div>
      <div className="flex items-center gap-3 shrink-0">
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

