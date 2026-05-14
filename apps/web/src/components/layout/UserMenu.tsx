'use client';

import Link from 'next/link';
import { useState, useRef, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { authApi } from '@/lib/api/auth';
import {
  ChevronDownIcon,
  UserIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  LogoutIcon,
} from '@/components/icons';

export interface UserMenuProps {
  username: string;
  localePrefix: string;
  avatarUrl?: string | null;
}

export function UserMenu({ username, localePrefix, avatarUrl }: UserMenuProps): JSX.Element {
  const t = useTranslations('common');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleLogout = (): void => {
    startTransition(async () => {
      try {
        await authApi.logout();
      } finally {
        setOpen(false);
        router.push(`${localePrefix}/`);
        router.refresh();
      }
    });
  };

  const items: { href: string; label: string; icon: JSX.Element }[] = [
    { href: `${localePrefix}/profile`, label: t('profileMenu'), icon: <UserIcon className="h-4 w-4" /> },
    { href: `${localePrefix}/deposit`, label: t('depositMenu'), icon: <ArrowDownIcon className="h-4 w-4" /> },
    { href: `${localePrefix}/withdraw`, label: t('withdrawMenu'), icon: <ArrowUpIcon className="h-4 w-4" /> },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 items-center gap-2 rounded-xl border border-border bg-bg-elevated px-2 sm:px-3 text-sm text-text-primary transition-colors hover:bg-bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="h-7 w-7 rounded-full object-cover ring-1 ring-border"
          />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand/30 to-accent-purple/30 text-[11px] font-bold uppercase text-brand">
            {username.slice(0, 2)}
          </span>
        )}
        <span className="hidden md:inline max-w-[8rem] truncate font-medium">@{username}</span>
        <ChevronDownIcon className={`h-4 w-4 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-bg-card shadow-card"
        >
          <div className="border-b border-border px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              {t('siteName')}
            </div>
            <div className="mt-0.5 truncate text-sm font-semibold text-text-primary">
              @{username}
            </div>
          </div>
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary"
              onClick={() => setOpen(false)}
              role="menuitem"
            >
              <span className="text-text-muted">{it.icon}</span>
              {it.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={handleLogout}
            role="menuitem"
            className="flex w-full items-center gap-2.5 border-t border-border px-4 py-2.5 text-left text-sm text-danger transition-colors hover:bg-danger/10"
          >
            <LogoutIcon className="h-4 w-4" />
            {t('logout')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
