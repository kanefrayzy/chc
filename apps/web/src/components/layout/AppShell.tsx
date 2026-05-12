import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileBottomNav, type MobileBottomNavItem } from './MobileBottomNav';
import { AuthModal } from './AuthModal';
import { DepositModal } from './DepositModal';
import { WithdrawModal } from './WithdrawModal';
import { UiProvider } from './ui-context';
import { getServerUser } from '@/lib/api/server';
import { getPublicSettings } from '@/lib/api/settings';
import { walletApi } from '@/lib/api/wallet';

export interface AppShellProps {
  locale: string;
  children: ReactNode;
}

export async function AppShell({ locale, children }: AppShellProps): Promise<JSX.Element> {
  const localePrefix = locale === 'ru' ? '' : `/${locale}`;
  const tNav = await getTranslations({ locale, namespace: 'nav' });
  const [user, settings] = await Promise.all([getServerUser(), getPublicSettings()]);

  let balanceMinor: string | null = null;
  if (user) {
    try { balanceMinor = (await walletApi.balance()).balanceMinor; } catch { /* */ }
  }

  const bottomItems: MobileBottomNavItem[] = [
    { href: '/', label: tNav('home'), icon: '🏠' },
  ];
  if (settings['gameplay.roulette_enabled']) {
    bottomItems.push({ href: '/roulette', label: tNav('roulette'), icon: '🎰' });
  }
  if (user) {
    bottomItems.push({ href: '/deposit', label: tNav('deposit'), icon: '💰' });
    if (settings['gameplay.chat_enabled']) {
      bottomItems.push({ href: '/chat', label: tNav('chat'), icon: '💬' });
    }
    bottomItems.push({ href: '/profile', label: tNav('profile'), icon: '👤' });
  } else if (settings['gameplay.ranks_enabled']) {
    bottomItems.push({ href: '/ranks', label: tNav('ranks'), icon: '🏆' });
  }

  return (
    <UiProvider>
      <div className="min-h-screen bg-bg-base">
        <Sidebar locale={locale} />
        <div className="lg:pl-64">
          <TopBar locale={locale} />
          <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:pb-12 lg:px-8">
            {children}
          </main>
        </div>
        <MobileBottomNav items={bottomItems} localePrefix={localePrefix} />
        <AuthModal />
        <DepositModal locale={locale} />
        <WithdrawModal locale={locale} balanceMinor={balanceMinor} />
      </div>
    </UiProvider>
  );
}
