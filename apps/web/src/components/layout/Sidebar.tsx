import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  HomeIcon,
  RouletteIcon,
  DiceIcon,
  CaseIcon,
  TrophyIcon,
  UsersIcon,
  UserIcon,
  GiftIcon,
  HeadsetIcon,
  QuestionIcon,
  ChatIcon,
  CrownIcon,
  TicketIcon,
  ArrowDownIcon,
  ArrowUpIcon,
} from '@/components/icons';
import { getServerUser } from '@/lib/api/server';
import { getPublicSettings } from '@/lib/api/settings';
import { SidebarNav, type SidebarItem, type SidebarSection } from './SidebarNav';
import { SidebarDrawer } from './SidebarDrawer';
import { LanguageSwitcher } from './LanguageSwitcher';
import { SocialLinks } from './SocialLinks';
import { OnlineCounter } from './OnlineCounter';

export interface SidebarProps {
  locale: string;
}

const ICON_CLS = 'h-5 w-5';

async function buildSections(locale: string): Promise<SidebarSection[]> {
  const tNav = await getTranslations({ locale, namespace: 'nav' });
  const tSidebar = await getTranslations({ locale, namespace: 'sidebar' });
  const [user, settings] = await Promise.all([getServerUser(), getPublicSettings()]);

  const games: SidebarItem[] = [
    { href: '/', label: tNav('home'), icon: <HomeIcon className={ICON_CLS} /> },
  ];
  if (settings['gameplay.roulette_enabled']) {
    games.push({
      href: '/roulette',
      label: tNav('roulette'),
      icon: <RouletteIcon className={ICON_CLS} />,
      badge: 'LIVE',
    });
  }
  games.push({
    href: '/classic',
    label: tNav('classic'),
    icon: <DiceIcon className={ICON_CLS} />,
    badge: tSidebar('soon'),
    disabled: true,
  });
  games.push({
    href: '/cases',
    label: tNav('cases'),
    icon: <CaseIcon className={ICON_CLS} />,
    badge: tSidebar('soon'),
    disabled: true,
  });
  games.push({
    href: '/play',
    label: tSidebar('insertCode'),
    icon: <TicketIcon className={ICON_CLS} />,
    action: 'code',
    badge: 'NEW',
  });
  if (settings['gameplay.ranks_enabled']) {
    games.push({
      href: '/ranks',
      label: tNav('ranks'),
      icon: <TrophyIcon className={ICON_CLS} />,
      action: 'ranks',
    });
  }

  const sections: SidebarSection[] = [{ title: tSidebar('games'), items: games }];

  const more: SidebarItem[] = [];
  if (settings['gameplay.referrals_enabled']) {
    more.push({
      href: '/referrals',
      label: tNav('referral'),
      icon: <UsersIcon className={ICON_CLS} />,
    });
  }
  more.push({
    href: '/faq',
    label: tNav('faq'),
    icon: <QuestionIcon className={ICON_CLS} />,
  });
  sections.push({ title: tSidebar('more'), items: more });

  if (user) {
    const account: SidebarItem[] = [
      { href: '/profile', label: tNav('profile'), icon: <UserIcon className={ICON_CLS} /> },
    ];
    if (settings['gameplay.chat_enabled']) {
      account.push({
        href: '/chat',
        label: tNav('chat'),
        icon: <ChatIcon className={ICON_CLS} />,
        action: 'chat',
      });
    }
    sections.push({ title: tSidebar('account'), items: account });

    sections.push({
      title: tSidebar('payments'),
      items: [
        {
          href: '/deposit',
          label: tNav('deposit'),
          icon: <ArrowDownIcon className={ICON_CLS} />,
          action: 'deposit',
        },
        {
          href: '/withdraw',
          label: tNav('withdraw'),
          icon: <ArrowUpIcon className={ICON_CLS} />,
          action: 'withdraw',
        },
      ],
    });
  }

  return sections;
}

export async function Sidebar({ locale }: SidebarProps): Promise<JSX.Element> {
  const localePrefix = locale === 'ru' ? '' : `/${locale}`;
  const settings = await getPublicSettings();
  const siteName = settings['brand.site_name'] || process.env.NEXT_PUBLIC_SITE_NAME || 'CHCGREEN';
  const logoUrl = settings['brand.logo_url'] || '';
  const sections = await buildSections(locale);
  const tSidebar = await getTranslations({ locale, namespace: 'sidebar' });

  const telegram = settings['brand.social_telegram'] || '';
  const instagram = settings['brand.social_instagram'] || '';
  const discord = settings['brand.social_discord'] || '';

  const inner = (
    <div className="flex h-full flex-col">
      <Link
        href={`${localePrefix}/`}
        className="flex items-center gap-2.5 rounded-lg px-3 pb-5 pt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        aria-label={siteName}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={siteName} className="h-14 w-14 rounded-lg object-contain" />
        ) : (
          <span
            aria-hidden
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-brand/25 to-accent-purple/20 text-brand shadow-[inset_0_0_0_1px_rgba(0,255,136,0.3)]"
          >
            <CrownIcon className="h-6 w-6" />
          </span>
        )}
        <div className="flex flex-col gap-0.5">
          <span className="text-base font-extrabold tracking-wide text-text-primary">
            {siteName}
          </span>
          <OnlineCounter />
        </div>
      </Link>

      <div className="flex-1 overflow-y-auto pr-1">
        <SidebarNav sections={sections} localePrefix={localePrefix} />
      </div>

      <div className="mt-4 space-y-3 border-t border-border pt-4">
        {settings['deposit.bonus_bps'] > 0 && (
          <div className="rounded-xl border border-brand/20 bg-gradient-to-br from-brand/10 to-accent-purple/10 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-brand">
              {tSidebar('promoTitle')}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              {tSidebar('promoText')}
            </p>
          </div>
        )}
        <LanguageSwitcher />
        <SocialLinks telegram={telegram} instagram={instagram} discord={discord} />
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:flex-col lg:border-r lg:border-border lg:bg-bg-elevated lg:px-3 lg:py-5">
        {inner}
      </aside>
      <SidebarDrawer>{inner}</SidebarDrawer>
    </>
  );
}
