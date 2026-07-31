'use client';

import type { ReactNode } from 'react';

/** Скелетон загрузки внутри панели кошелька. */
export function PanelSkeleton({ lines = 3 }: { lines?: number }): JSX.Element {
  return (
    <div className="space-y-2.5" aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-14 animate-pulse rounded-xl bg-bg-card"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </div>
  );
}

const messageVariants = {
  danger: 'border-danger/30 bg-danger/10 text-danger',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  info: 'border-info/30 bg-info/10 text-info',
  success: 'border-brand/30 bg-brand/10 text-brand',
} as const;

export function PanelMessage({
  variant = 'info',
  children,
}: {
  variant?: keyof typeof messageVariants;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className={`rounded-xl border px-3.5 py-2.5 text-xs font-medium ${messageVariants[variant]}`}>
      {children}
    </div>
  );
}

/** Основная кнопка панели: во всю ширину, с неоновым свечением. */
export function SubmitButton({
  loading,
  disabled,
  accent = 'brand',
  children,
}: {
  loading?: boolean;
  disabled?: boolean;
  accent?: 'brand' | 'purple';
  children: ReactNode;
}): JSX.Element {
  const base =
    accent === 'brand'
      ? 'bg-brand text-bg-base hover:bg-brand-dim hover:shadow-[0_0_28px_rgba(0,255,136,0.35)]'
      : 'bg-accent-purple text-white hover:bg-accent-purple/90 hover:shadow-[0_0_28px_rgba(162,89,255,0.35)]';

  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className={[
        'flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
        base,
      ].join(' ')}
    >
      {loading && (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
