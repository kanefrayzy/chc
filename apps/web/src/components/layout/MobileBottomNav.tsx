'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@chcgreen/ui';

export interface MobileBottomNavItem {
  href: string;
  label: string;
  icon: string;
}

export interface MobileBottomNavProps {
  items: MobileBottomNavItem[];
  localePrefix: string;
}

export function MobileBottomNav({ items, localePrefix }: MobileBottomNavProps): JSX.Element {
  const pathname = usePathname();
  return (
    <nav className="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg-elevated/95 backdrop-blur">
      <ul className="grid grid-cols-5 gap-1 px-2 py-1.5">
        {items.map((item) => {
          const full = `${localePrefix}${item.href}`;
          const active =
            item.href === '/'
              ? pathname === localePrefix || pathname === `${localePrefix}/`
              : pathname === full || pathname.startsWith(`${full}/`);
          return (
            <li key={item.href}>
              <Link
                href={full}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-[10px] font-medium transition-colors',
                  active
                    ? 'bg-brand/15 text-brand'
                    : 'text-text-secondary hover:text-text-primary',
                )}
              >
                <span aria-hidden className="text-base leading-none">
                  {item.icon}
                </span>
                <span className="truncate max-w-[64px]">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
