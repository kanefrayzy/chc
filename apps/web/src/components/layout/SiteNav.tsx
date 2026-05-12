'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavItem {
  href: string;
  label: string;
}

export interface SiteNavProps {
  items: readonly NavItem[];
  localePrefix: string;
}

export function SiteNav({ items, localePrefix }: SiteNavProps): JSX.Element {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    const full = `${localePrefix}${href}`;
    if (href === '/') return pathname === localePrefix || pathname === `${localePrefix}/`;
    return pathname === full || pathname.startsWith(`${full}/`);
  }

  return (
    <nav className="hidden md:flex items-center gap-1">
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={`${localePrefix}${item.href}`}
            className={
              active
                ? 'px-3 py-1.5 rounded-md text-sm font-medium bg-brand/15 text-brand'
                : 'px-3 py-1.5 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-card-hover transition-colors'
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
