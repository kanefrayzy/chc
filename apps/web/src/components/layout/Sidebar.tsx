import Link from 'next/link';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { getServerUser } from '@/lib/api/server';
import { getPublicSettings } from '@/lib/api/settings';
import { SidebarNav, type SidebarItem, type SidebarSection } from './SidebarNav';
import { SidebarDrawer } from './SidebarDrawer';

export interface SidebarProps {
  locale: string;
}

function Icon({ children }: { children: ReactNode }): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const ICONS = {
  home: (
    <Icon>
      <path d="M3 12L12 3l9 9" />
      <path d="M5 10v10h14V10" />
    </Icon>
  ),
  roulette: (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
    </Icon>
  ),
  ranks: (
    <Icon>
      <path d="M8 21h8M12 17v4" />
      <path d="M7 4h10v6a5 5 0 0 1-10 0V4z" />
      <path d="M17 5h3v3a3 3 0 0 1-3 3M7 5H4v3a3 3 0 0 0 3 3" />
    </Icon>
  ),
  chat: (
    <Icon>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </Icon>
  ),
  referral: (
    <Icon>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </Icon>
  ),
  profile: (
    <Icon>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </Icon>
  ),
  deposit: (
    <Icon>
      <path d="M12 5v14M5 12l7 7 7-7" />
    </Icon>
  ),
  withdraw: (
    <Icon>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </Icon>
  ),
};

async function buildSections(locale: string): Promise<SidebarSection[]> {
  const tNav = await getTranslations({ locale, namespace: 'nav' });
  const tSidebar = await getTranslations({ locale, namespace: 'sidebar' });
  const [user, settings] = await Promise.all([getServerUser(), getPublicSettings()]);

  const games: SidebarItem[] = [{ href: '/', label: tNav('home'), icon: ICONS.home }];
  if (settings['gameplay.roulette_enabled']) {
    games.push({ href: '/roulette', label: tNav('roulette'), icon: ICONS.roulette, badge: 'LIVE' });
  }
  if (settings['gameplay.ranks_enabled']) {
    games.push({ href: '/ranks', label: tNav('ranks'), icon: ICONS.ranks, action: 'ranks' });
  }

  const sections: SidebarSection[] = [{ title: tSidebar('games'), items: games }];

  if (user) {
    const account: SidebarItem[] = [
      { href: '/profile', label: tNav('profile'), icon: ICONS.profile },
    ];
    if (settings['gameplay.chat_enabled']) {
      account.push({ href: '/chat', label: tNav('chat'), icon: ICONS.chat, action: 'chat' });
    }
    if (settings['gameplay.referrals_enabled']) {
      account.push({ href: '/referrals', label: tNav('referral'), icon: ICONS.referral });
    }
    sections.push({ title: tSidebar('account'), items: account });

    sections.push({
      title: tSidebar('payments'),
      items: [
        { href: '/deposit', label: tNav('deposit'), icon: ICONS.deposit, action: 'deposit' },
        { href: '/withdraw', label: tNav('withdraw'), icon: ICONS.withdraw, action: 'withdraw' },
      ],
    });
  }

  return sections;
}

export async function Sidebar({ locale }: SidebarProps): Promise<JSX.Element> {
  const localePrefix = locale === 'ru' ? '' : `/${locale}`;
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? 'CHCGREEN';
  const sections = await buildSections(locale);
  const tSidebar = await getTranslations({ locale, namespace: 'sidebar' });

  const inner = (
    <>
      <Link
        href={`${localePrefix}/`}
        className="flex items-center gap-2.5 px-3 pb-4 pt-2"
      >
        <span
          aria-hidden
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/15 text-lg shadow-[inset_0_0_0_1px_rgba(0,255,136,0.3)]"
        >
          👑
        </span>
        <span className="text-base font-bold tracking-wide text-text-primary">
          {siteName}
        </span>
      </Link>
      <SidebarNav sections={sections} localePrefix={localePrefix} />
      <div className="mt-auto pt-6">
        <div className="rounded-xl border border-brand/20 bg-gradient-to-br from-brand/10 to-accent-purple/10 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-brand">
            {tSidebar('promoTitle')}
          </div>
          <p className="mt-1 text-xs text-text-secondary">{tSidebar('promoText')}</p>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:flex-col lg:border-r lg:border-border lg:bg-bg-elevated lg:px-3 lg:py-5">
        {inner}
      </aside>
      {/* Mobile drawer */}
      <SidebarDrawer>{inner}</SidebarDrawer>
    </>
  );
}
