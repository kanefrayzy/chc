import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileBottomNav, type MobileBottomNavItem } from './MobileBottomNav';
import { Suspense } from 'react';
import { AuthModal } from './AuthModal';
import { WalletModalHost } from './WalletModalHost';
import { PaymentReturnHandler } from './PaymentReturnHandler';
import { RanksModal } from './RanksModal';
import { RedeemCodeModal } from './RedeemCodeModal';
import { ChatWidget } from './ChatWidget';
import { UiProvider } from './ui-context';
import {
  HomeIcon,
  RouletteIcon,
  TrophyIcon,
  UserIcon,
  ChatIcon,
  ArrowDownIcon,
} from '@/components/icons';
import { getServerUser } from '@/lib/api/server';
import { getPublicSettings } from '@/lib/api/settings';
import { walletApi } from '@/lib/api/wallet';

export interface AppShellProps {
  locale: string;
  children: ReactNode;
}

const BN_ICON = 'h-5 w-5';

export async function AppShell({ locale, children }: AppShellProps): Promise<JSX.Element> {
  const localePrefix = locale === 'ru' ? '' : `/${locale}`;
  const tNav = await getTranslations({ locale, namespace: 'nav' });
  const [user, settings] = await Promise.all([getServerUser(), getPublicSettings()]);

  let balanceMinor: string | null = null;
  if (user) {
    try {
      balanceMinor = (await walletApi.balance()).balanceMinor;
    } catch {
      /* silent */
    }
  }

  const bottomItems: MobileBottomNavItem[] = [
    { href: '/', label: tNav('home'), icon: <HomeIcon className={BN_ICON} /> },
  ];
  if (settings['gameplay.roulette_enabled']) {
    bottomItems.push({
      href: '/roulette',
      label: tNav('roulette'),
      icon: <RouletteIcon className={BN_ICON} />,
    });
  }
  if (user) {
    bottomItems.push({
      href: '/',
      label: tNav('deposit'),
      icon: <ArrowDownIcon className={BN_ICON} />,
      action: 'deposit',
    });
    if (settings['gameplay.chat_enabled']) {
      bottomItems.push({
        href: '/chat',
        label: tNav('chat'),
        icon: <ChatIcon className={BN_ICON} />,
        action: 'chat',
      });
    }
    bottomItems.push({
      href: '/profile',
      label: tNav('profile'),
      icon: <UserIcon className={BN_ICON} />,
    });
  } else {
    bottomItems.push({
      href: '/ranks',
      label: tNav('ranks'),
      icon: <TrophyIcon className={BN_ICON} />,
    });
  }

  return (
    <UiProvider>
      <div className="min-h-screen bg-bg-base">
        <Sidebar locale={locale} />
        <div className="lg:pl-64">
          <TopBar locale={locale} />
          <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-12">
            {children}
          </main>
        </div>
        <MobileBottomNav items={bottomItems} localePrefix={localePrefix} />
        <AuthModal />
        <WalletModalHost locale={locale} initialBalanceMinor={balanceMinor} />
        {user && (
          <Suspense fallback={null}>
            <PaymentReturnHandler />
          </Suspense>
        )}
        <RanksModal locale={locale} isAuthed={Boolean(user)} />
        <RedeemCodeModal isAuthed={Boolean(user)} />
        <ChatWidget viewerId={user?.id ?? null} />
      </div>
    </UiProvider>
  );
}
