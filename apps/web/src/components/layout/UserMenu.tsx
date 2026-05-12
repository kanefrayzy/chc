'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { authApi } from '@/lib/api/auth';

export interface UserMenuProps {
  username: string;
  localePrefix: string;
}

export function UserMenu({ username, localePrefix }: UserMenuProps): JSX.Element {
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
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
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

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary hover:bg-bg-card-hover"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/20 text-xs font-bold uppercase text-brand">
          {username.slice(0, 2)}
        </span>
        <span className="hidden sm:inline max-w-[8rem] truncate">@{username}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-4 w-4 text-text-muted"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-bg-card shadow-card"
        >
          <Link
            href={`${localePrefix}/profile`}
            className="block px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-card-hover hover:text-text-primary"
            onClick={() => setOpen(false)}
          >
            {t('profileMenu')}
          </Link>
          <Link
            href={`${localePrefix}/deposit`}
            className="block px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-card-hover hover:text-text-primary"
            onClick={() => setOpen(false)}
          >
            {t('depositMenu')}
          </Link>
          <Link
            href={`${localePrefix}/withdraw`}
            className="block px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-card-hover hover:text-text-primary"
            onClick={() => setOpen(false)}
          >
            {t('withdrawMenu')}
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="block w-full border-t border-border px-4 py-2.5 text-left text-sm text-danger hover:bg-danger/10"
          >
            {t('logout')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
