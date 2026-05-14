'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@chcgreen/ui';
import { useUi } from './ui-context';

export interface MobileBottomNavItem {
  href: string;
  label: string;
  icon: ReactNode;
  action?: 'deposit' | 'chat';
}

export interface MobileBottomNavProps {
  items: MobileBottomNavItem[];
  localePrefix: string;
}

export function MobileBottomNav({ items, localePrefix }: MobileBottomNavProps): JSX.Element {
  const pathname = usePathname() ?? '/';
  const { openDeposit, toggleChat } = useUi();

  const handleAction = (action: MobileBottomNavItem['action']): void => {
    if (action === 'deposit') openDeposit();
    else if (action === 'chat') toggleChat();
  };

  const cols = Math.min(items.length, 5);

  return (
    <nav
      aria-label="Mobile navigation"
      className="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-bg-card/95 backdrop-blur-md shadow-[0_-4px_24px_rgba(0,0,0,0.4)] pb-[env(safe-area-inset-bottom)]"
    >
      <ul
        className="grid px-2 py-1.5"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: '4px' }}
      >
        {items.map((item) => {
          const full = `${localePrefix}${item.href}`;
          const active = item.action
            ? false
            : item.href === '/'
            ? pathname === localePrefix || pathname === `${localePrefix}/`
            : pathname === full || pathname.startsWith(`${full}/`);

          const base =
            'flex w-full min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10px] font-semibold transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40';

          if (item.action) {
            const isDeposit = item.action === 'deposit';
            return (
              <li key={`${item.action}-${item.href}`}>
                <button
                  type="button"
                  onClick={() => handleAction(item.action)}
                  className={cn(
                    base,
                    isDeposit
                      ? 'bg-brand text-black shadow-[0_2px_12px_rgba(0,255,136,0.4)]'
                      : 'text-text-secondary hover:text-brand',
                  )}
                >
                  <span className="flex h-5 w-5 items-center justify-center">{item.icon}</span>
                  <span className="truncate max-w-[64px] leading-tight">{item.label}</span>
                </button>
              </li>
            );
          }

          return (
            <li key={item.href}>
              <Link
                href={full}
                className={cn(
                  base,
                  active ? 'bg-brand/15 text-brand' : 'text-text-muted hover:text-text-secondary',
                )}
              >
                <div className="relative flex h-5 w-5 items-center justify-center">
                  {item.icon}
                  {active ? (
                    <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-brand" />
                  ) : null}
                </div>
                <span className="truncate max-w-[64px] leading-tight">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
