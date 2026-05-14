'use client';

import Link from 'next/link';
import { usePathname, useParams, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@chcgreen/ui';
import { useUi } from './ui-context';

export type SidebarAction = 'deposit' | 'withdraw' | 'ranks' | 'chat' | 'code';

export interface SidebarItem {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: string;
  action?: SidebarAction;
  disabled?: boolean;
}

export interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

export interface SidebarNavProps {
  sections: SidebarSection[];
  localePrefix: string;
}

function badgeClasses(badge: string): string {
  if (badge === 'LIVE') return 'bg-danger/15 text-danger ring-1 ring-danger/30';
  if (badge === 'NEW') return 'bg-info/15 text-info ring-1 ring-info/30';
  if (badge === 'VIP') return 'bg-warning/15 text-warning ring-1 ring-warning/30';
  return 'bg-bg-elevated text-text-muted ring-1 ring-border';
}

export function SidebarNav({ sections, localePrefix }: SidebarNavProps): JSX.Element {
  const pathname = usePathname() ?? '/';
  const params = useParams<{ locale: string }>();
  const router = useRouter();
  const { closeSidebar, openDeposit, openWithdraw, openRanks, toggleChat } = useUi();

  function isActive(href: string): boolean {
    const full = `${localePrefix}${href}`;
    if (href === '/') return pathname === localePrefix || pathname === `${localePrefix}/`;
    return pathname === full || pathname.startsWith(`${full}/`);
  }

  function runAction(action: SidebarAction): void {
    closeSidebar();
    if (action === 'deposit') openDeposit();
    else if (action === 'withdraw') openWithdraw();
    else if (action === 'ranks') openRanks();
    else if (action === 'chat') toggleChat();
    else if (action === 'code') {
      const locale = params?.locale ?? '';
      router.push(`/${locale}/play`);
    }
  }

  return (
    <nav className="flex flex-col gap-5">
      {sections.map((section) => (
        <div key={section.title} className="flex flex-col gap-0.5">
          <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
            {section.title}
          </div>
          {section.items.map((item) => {
            const active = !item.action && !item.disabled && isActive(item.href);
            const baseClass = cn(
              'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
              item.disabled
                ? 'cursor-not-allowed text-text-muted/70'
                : active
                ? 'bg-brand/12 text-brand shadow-[inset_2px_0_0_0_theme(colors.brand.DEFAULT)]'
                : 'text-text-secondary hover:bg-bg-card-hover hover:text-text-primary',
            );
            const inner = (
              <>
                <span
                  aria-hidden
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center transition-colors',
                    item.disabled
                      ? 'text-text-muted/60'
                      : active
                      ? 'text-brand'
                      : 'text-text-muted group-hover:text-text-primary',
                  )}
                >
                  {item.icon}
                </span>
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge ? (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                      badgeClasses(item.badge),
                    )}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </>
            );
            if (item.disabled) {
              return (
                <div key={item.href} className={baseClass} aria-disabled="true">
                  {inner}
                </div>
              );
            }
            if (item.action) {
              return (
                <button
                  key={`${item.action}-${item.href}`}
                  type="button"
                  onClick={() => runAction(item.action!)}
                  className={baseClass}
                >
                  {inner}
                </button>
              );
            }
            return (
              <Link
                key={item.href}
                href={`${localePrefix}${item.href}`}
                onClick={closeSidebar}
                className={baseClass}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
