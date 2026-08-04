'use client';

import { usePathname, useRouter, useParams } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@chcgreen/ui';
import { ChevronDownIcon, GlobeIcon } from '@/components/icons';

const LOCALES = [
  { code: 'ru', label: 'RU' },
  { code: 'az', label: 'AZ' },
] as const;

type LocaleCode = (typeof LOCALES)[number]['code'];

export interface LanguageSwitcherProps {
  variant?: 'sidebar' | 'compact';
}

export function LanguageSwitcher({ variant = 'sidebar' }: LanguageSwitcherProps): JSX.Element {
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const params = useParams<{ locale?: string }>();
  const currentLocale = (params?.locale as LocaleCode) ?? 'ru';
  const [open, setOpen] = useState(false);
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

  function switchTo(next: LocaleCode): void {
    setOpen(false);
    if (next === currentLocale) return;
    const segments = pathname.split('/').filter(Boolean);
    if (LOCALES.some((l) => l.code === segments[0])) segments.shift();
    const target = `/${next}${segments.length ? '/' + segments.join('/') : ''}`;
    router.push(target);
    router.refresh();
  }

  const current = LOCALES.find((l) => l.code === currentLocale) ?? LOCALES[0];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-2 rounded-xl border border-border bg-bg-elevated text-text-primary transition-colors hover:bg-bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
          variant === 'sidebar' ? 'w-full px-3 py-2.5 text-sm justify-between' : 'h-9 px-3 text-xs',
        )}
      >
        <span className="flex items-center gap-2">
          <GlobeIcon className="h-4 w-4 text-text-muted" />
          <span className="font-semibold tracking-wide">{current.label}</span>
        </span>
        <ChevronDownIcon
          className={cn('h-4 w-4 text-text-muted transition-transform', open && 'rotate-180')}
        />
      </button>
      {open ? (
        <div
          role="listbox"
          className={cn(
            'absolute z-40 mt-2 overflow-hidden rounded-xl border border-border bg-bg-card shadow-card',
            variant === 'sidebar' ? 'left-0 right-0 bottom-full mb-2' : 'right-0 min-w-[8rem]',
          )}
        >
          {LOCALES.map((l) => {
            const active = l.code === currentLocale;
            return (
              <button
                key={l.code}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => switchTo(l.code)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                  active
                    ? 'bg-brand/10 text-brand'
                    : 'text-text-secondary hover:bg-bg-card-hover hover:text-text-primary',
                )}
              >
                <span className="font-semibold">{l.label}</span>
                <span className="ml-auto text-xs text-text-muted">
                  {l.code === 'ru' ? 'Русский' : 'Azərbaycan'}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
