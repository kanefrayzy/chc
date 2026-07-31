'use client';

import type { PublicPaymentMethod } from '@/lib/api/payment-methods';

export interface MethodPickerProps {
  methods: PublicPaymentMethod[];
  selectedId: string | null;
  onSelect: (method: PublicPaymentMethod) => void;
  disabled?: boolean;
  label: string;
  accent?: 'brand' | 'purple';
}

/** Плитки выбора платёжного метода с иконкой, названием и валютой. */
export function MethodPicker({
  methods,
  selectedId,
  onSelect,
  disabled,
  label,
  accent = 'brand',
}: MethodPickerProps): JSX.Element {
  const activeClasses =
    accent === 'brand'
      ? 'border-brand/70 bg-brand/[0.07] shadow-[0_0_0_3px_rgba(0,255,136,0.08)]'
      : 'border-accent-purple/70 bg-accent-purple/[0.07] shadow-[0_0_0_3px_rgba(162,89,255,0.10)]';
  const checkClasses = accent === 'brand' ? 'bg-brand text-bg-base' : 'bg-accent-purple text-white';

  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">{label}</div>
      <div className="grid gap-2 sm:grid-cols-2">
        {methods.map((m) => {
          const active = m.id === selectedId;
          return (
            <button
              type="button"
              key={m.id}
              onClick={() => onSelect(m)}
              disabled={disabled}
              aria-pressed={active}
              className={[
                'group relative flex items-center gap-3 rounded-xl border p-3 text-left transition-all',
                'disabled:cursor-not-allowed disabled:opacity-50',
                active
                  ? activeClasses
                  : 'border-border bg-bg-card hover:border-border-strong hover:bg-bg-card-hover',
              ].join(' ')}
            >
              {m.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.iconUrl}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-lg bg-bg-base object-contain p-0.5"
                />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-base text-[11px] font-bold text-text-secondary">
                  {m.name.slice(0, 2).toUpperCase()}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold leading-tight text-text-primary">
                  {m.name}
                </span>
                <span className="mt-0.5 block truncate text-[11px] leading-tight text-text-muted">
                  {m.description ?? m.currency}
                </span>
              </span>
              {active && (
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${checkClasses}`}
                >
                  <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
                    <path
                      d="M2.5 6.2l2.2 2.2 4.8-4.8"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
