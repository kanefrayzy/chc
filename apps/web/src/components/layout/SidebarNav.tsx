'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@chcgreen/ui';
import { useUi } from './ui-context';

export interface SidebarItem {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: string;
}

export interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

export interface SidebarNavProps {
  sections: SidebarSection[];
  localePrefix: string;
}

export function SidebarNav({ sections, localePrefix }: SidebarNavProps): JSX.Element {
  const pathname = usePathname();
  const { closeSidebar } = useUi();

  function isActive(href: string): boolean {
    const full = `${localePrefix}${href}`;
    if (href === '/') return pathname === localePrefix || pathname === `${localePrefix}/`;
    return pathname === full || pathname.startsWith(`${full}/`);
  }

  return (
    <nav className="flex flex-col gap-6">
      {sections.map((section) => (
        <div key={section.title} className="flex flex-col gap-1">
          <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            {section.title}
          </div>
          {section.items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={`${localePrefix}${item.href}`}
                onClick={closeSidebar}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-brand/12 text-brand shadow-[inset_2px_0_0_0_theme(colors.brand.DEFAULT)]'
                    : 'text-text-secondary hover:bg-bg-card-hover hover:text-text-primary',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'flex h-5 w-5 items-center justify-center transition-colors',
                    active ? 'text-brand' : 'text-text-muted group-hover:text-text-primary',
                  )}
                >
                  {item.icon}
                </span>
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge ? (
                  <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
