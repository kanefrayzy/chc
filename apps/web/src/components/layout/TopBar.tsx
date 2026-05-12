import Link from 'next/link';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { getServerUser } from '@/lib/api/server';
import { apiFetch } from '@/lib/api/client';
import type { WalletBalanceDto } from '@/lib/api/wallet';
import { SidebarToggleButton } from './SidebarToggleButton';
import { BalancePill } from './BalancePill';
import { AuthButtons } from './AuthButtons';
import { UserMenu } from './UserMenu';

export interface TopBarProps {
  locale: string;
}

export async function TopBar({ locale }: TopBarProps): Promise<JSX.Element> {
  const localePrefix = locale === 'ru' ? '' : `/${locale}`;
  const user = await getServerUser();
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? 'CHCGREEN';

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
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <SidebarToggleButton />
        <Link
          href={`${localePrefix}/`}
          className="flex items-center gap-2 lg:hidden"
          aria-label={siteName}
        >
          <span aria-hidden className="text-xl">
            👑
          </span>
          <span className="text-sm font-bold tracking-wide text-text-primary">
            {siteName}
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <BalancePill
                locale={locale as 'ru' | 'az' | 'en'}
                initialBalanceMinor={initialBalance}
                depositHref={`${localePrefix}/deposit`}
                withdrawHref={`${localePrefix}/withdraw`}
              />
              <UserMenu username={user.username} localePrefix={localePrefix} />
            </>
          ) : (
            <AuthButtons />
          )}
        </div>
      </div>
    </header>
  );
}
