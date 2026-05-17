import Link from 'next/link';
import Image from 'next/image';
import { cookies } from 'next/headers';
import { getServerUser } from '@/lib/api/server';
import { apiFetch } from '@/lib/api/client';
import { getPublicSettings } from '@/lib/api/settings';
import type { WalletBalanceDto } from '@/lib/api/wallet';
import { CrownIcon } from '@/components/icons';
import { SidebarToggleButton } from './SidebarToggleButton';
import { BalancePill } from './BalancePill';
import { AuthButtons } from './AuthButtons';
import { UserMenu } from './UserMenu';
import { RedeemCodeButton } from './RedeemCodeButton';
import { OnlineCounter } from './OnlineCounter';

export interface TopBarProps {
  locale: string;
}

export async function TopBar({ locale }: TopBarProps): Promise<JSX.Element> {
  const localePrefix = locale === 'ru' ? '' : `/${locale}`;
  const user = await getServerUser();
  const settings = await getPublicSettings();
  const siteName = settings['brand.site_name'] || process.env.NEXT_PUBLIC_SITE_NAME || 'CHCGREEN';
  const logoUrl = settings['brand.logo_url'] || '';

  let initialBalance: string | null = null;
  if (user) {
    try {
      const cookieHeader = cookies()
        .getAll()
        .map((c) => `${c.name}=${c.value}`)
        .join('; ');
      const res = await apiFetch<WalletBalanceDto>('/wallet/balance', {
        headers: { Cookie: cookieHeader },
      });
      initialBalance = res.balanceMinor;
    } catch {
      initialBalance = null;
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg-base/85 backdrop-blur supports-[backdrop-filter]:bg-bg-base/70">
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-6">
        <SidebarToggleButton />
        <Link
          href={`${localePrefix}/`}
          className="flex items-center gap-2 lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded-lg"
          aria-label={siteName}
        >
          {logoUrl ? (
            <Image src={logoUrl} alt={siteName} width={40} height={40} className="rounded-md" />
          ) : (
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand/25 to-accent-purple/20 text-brand"
            >
              <CrownIcon className="h-5 w-5" />
            </span>
          )}
          <span className="hidden xs:inline text-sm font-extrabold tracking-wide text-text-primary">
            {siteName}
          </span>
        </Link>
        <div className="lg:hidden">
          <OnlineCounter />
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <RedeemCodeButton />
              <BalancePill
                locale={locale as 'ru' | 'az' | 'en'}
                initialBalanceMinor={initialBalance}
                depositHref={`${localePrefix}/deposit`}
                withdrawHref={`${localePrefix}/withdraw`}
              />
              <UserMenu username={user.username} avatarUrl={user.avatarUrl ?? null} localePrefix={localePrefix} />
            </>
          ) : (
            <AuthButtons />
          )}
        </div>
      </div>
    </header>
  );
}
