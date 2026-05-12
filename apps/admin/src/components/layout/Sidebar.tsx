'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '../../lib/cn';

interface NavItem {
  href: string;
  label: string;
  badge?: number;
  superAdminOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Сводка' },
  { href: '/code-purchases', label: 'Покупки кода' },
  { href: '/withdrawals', label: 'Выводы' },
  { href: '/tickets', label: 'Тикеты' },
  { href: '/users', label: 'Пользователи' },
  { href: '/audit', label: 'Аудит-лог' },
];

export function Sidebar({
  username,
  role,
}: {
  username: string;
  role: 'USER' | 'MODERATOR' | 'SUPER_ADMIN';
}) {
  const pathname = usePathname();
  return (
    <aside className="w-60 bg-sidebar text-sidebar-text flex flex-col">
      <div className="admin-brand-stripe h-1 w-full" />
      <div className="px-5 py-5 border-b border-sidebar-elev">
        <div className="text-xs uppercase tracking-widest text-sidebar-muted">
          CHCGreen · Admin
        </div>
        <div className="mt-1 text-sm font-semibold text-white">
          {username}
        </div>
        <div className="mt-0.5 text-xs text-sidebar-muted">
          {role === 'SUPER_ADMIN' ? 'Главный администратор' : 'Модератор'}
        </div>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors',
                active
                  ? 'bg-primary text-white font-medium'
                  : 'text-sidebar-text hover:bg-sidebar-hover',
              )}
            >
              <span>{item.label}</span>
              {item.badge ? (
                <span className="text-xs bg-accent text-ink-900 px-1.5 rounded">{item.badge}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-3 border-t border-sidebar-elev text-xs text-sidebar-muted">
        v0.1 · MVP
      </div>
    </aside>
  );
}
