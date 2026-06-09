'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '../../lib/cn';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  superAdminOnly?: boolean;
  moderatorHidden?: boolean;
}

function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const NAV: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Сводка',
    icon: <Icon d="M3 3h7v7H3V3zM14 3h7v7h-7V3zM3 14h7v7H3v-7zM14 14h7v7h-7v-7z" />,
    moderatorHidden: true,
  },
  {
    href: '/statistics',
    label: 'Статистика',
    icon: <Icon d="M3 3v18h18M7 16l4-5 3 3 5-7" />,
    superAdminOnly: true,
  },
  {
    href: '/code-purchases',
    label: 'Покупки кода',
    icon: <Icon d="M15 5H9a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V7a2 2 0 00-2-2zM9 9h6M9 13h6M9 17h4" />,
    moderatorHidden: true,
  },
  {
    href: '/withdrawals',
    label: 'Выводы',
    icon: <Icon d="M12 2v20M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 010 7H6" />,
  },
  {
    href: '/tickets',
    label: 'Тикеты',
    icon: <Icon d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" />,
  },
  {
    href: '/users',
    label: 'Пользователи',
    icon: <Icon d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />,
    moderatorHidden: true,
  },
  {
    href: '/audit',
    label: 'Аудит',
    icon: <Icon d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />,
    moderatorHidden: true,
  },
  {
    href: '/ranks',
    label: 'Ранги',
    icon: <Icon d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />,
    superAdminOnly: true,
  },
  {
    href: '/payment-methods',
    label: 'Платёжные методы',
    icon: <Icon d="M2 7h20v10H2zM2 11h20M6 15h4" />,
    superAdminOnly: true,
  },
  {
    href: '/roulette',
    label: 'Рулетка',
    icon: <Icon d="M12 2a10 10 0 100 20A10 10 0 0012 2zm0 3a7 7 0 110 14A7 7 0 0112 5zm0 2a5 5 0 100 10A5 5 0 0012 7zm0 2a3 3 0 110 6 3 3 0 010-6z" />,
    superAdminOnly: true,
  },
  {
    href: '/mines',
    label: 'Mines',
    icon: <Icon d="M12 2 L20 9 L12 22 L4 9 Z M4 9 H20" />,
    superAdminOnly: true,
  },
  {
    href: '/classic',
    label: 'Классический',
    icon: <Icon d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83M12 8a4 4 0 100 8 4 4 0 000-8z" />,
    superAdminOnly: true,
  },
  {
    href: '/settings',
    label: 'Настройки',
    icon: <Icon d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />,
    superAdminOnly: true,
  },
  {
    href: '/translations',
    label: 'Переводы',
    icon: <Icon d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />,
    superAdminOnly: true,
  },
];

export function Sidebar({
  username,
  role,
}: {
  username: string;
  role: 'USER' | 'MODERATOR' | 'SUPER_ADMIN';
}) {
  const pathname = usePathname();
  const visibleNav = NAV.filter(
    (item) =>
      (!item.superAdminOnly || role === 'SUPER_ADMIN') &&
      (!item.moderatorHidden || role !== 'MODERATOR'),
  );

  return (
    <aside className="w-64 bg-sidebar flex flex-col h-screen overflow-hidden select-none shrink-0">
      {/* Logo */}
      <div className="px-5 pt-5 pb-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <span className="text-white text-sm font-bold">A</span>
          </div>
          <div>
            <div className="text-sm font-semibold text-white leading-none">CHCGreen</div>
            <div className="text-xs text-sidebar-muted leading-none mt-0.5">Admin panel</div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 mb-2 h-px bg-sidebar-border shrink-0" />

      {/* Nav */}
      <nav className="flex-1 px-3 py-1 space-y-0.5 overflow-y-auto sidebar-scroll">
        {visibleNav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl transition-all group',
                active
                  ? 'bg-sidebar-active text-white font-medium'
                  : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white',
              )}
            >
              <span className={cn(
                'shrink-0 transition-colors',
                active ? 'text-primary-light' : 'text-sidebar-muted group-hover:text-sidebar-text',
              )}>
                {item.icon}
              </span>
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span className="shrink-0 bg-danger text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-4 mt-2 mb-3 h-px bg-sidebar-border shrink-0" />

      {/* User */}
      <div className="px-4 pb-4 shrink-0">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-sidebar-hover">
          <div className="w-8 h-8 rounded-full bg-primary-dark flex items-center justify-center text-white text-sm font-semibold shrink-0">
            {username.slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">{username}</div>
            <div className="text-xs text-sidebar-muted truncate">
              {role === 'SUPER_ADMIN' ? 'Супер-админ' : 'Модератор'}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

