'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@chcgreen/ui';
import { useUi } from './ui-context';

export interface MobileBottomNavItem {
  href: string;
  label: string;
  icon: string;
  action?: 'deposit' | 'chat';
}

export interface MobileBottomNavProps {
  items: MobileBottomNavItem[];
  localePrefix: string;
}

export function MobileBottomNav({ items, localePrefix }: MobileBottomNavProps): JSX.Element {
  const pathname = usePathname();
  const { openDeposit, toggleChat } = useUi();

  const handleAction = (action: MobileBottomNavItem['action']): void => {
    if (action === 'deposit') openDeposit();
    else if (action === 'chat') toggleChat();
  };

  const cols = Math.min(items.length, 5);

  return (
    <nav className="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-bg-card/95 backdrop-blur-md shadow-[0_-4px_24px_rgba(0,0,0,0.4)]">
      <ul
        className="grid px-2 py-2"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '4px' }}
      >
        {items.map((item) => {
          const full = `${localePrefix}${item.href}`;
          const active = item.action
            ? false
            : item.href === '/'
            ? pathname === localePrefix || pathname === `${localePrefix}/`
            : pathname === full || pathname.startsWith(`${full}/`);

          if (item.action) {
            return (
              <li key={item.href}>
                <button
                  type="button"
                  onClick={() => handleAction(item.action)}
                  className={cn(
                    'w-full flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[10px] font-semibold transition-all active:scale-95',
                    item.action === 'deposit'
                      ? 'bg-brand text-black shadow-[0_2px_12px_rgba(0,255,136,0.4)]'
                      : 'text-text-secondary hover:text-brand',
                  )}
                >
                  <span className="text-lg leading-none">{item.icon}</span>
                  <span className="truncate max-w-[56px]">{item.label}</span>
                </button>
              </li>
            );
          }

          return (
            <li key={item.href}>
              <Link
                href={full}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[10px] font-semibold transition-all active:scale-95',
                  active
                    ? 'bg-brand/15 text-brand'
                    : 'text-text-muted hover:text-text-secondary',
                )}
              >
                {/* Индикатор активности */}
                <div className="relative">
                  <span className="text-lg leading-none">{item.icon}</span>
                  {active && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand" />
                  )}
                </div>
                <span className="truncate max-w-[56px] mt-0.5">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

