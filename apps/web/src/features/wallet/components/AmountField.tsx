'use client';

import { useMemo } from 'react';

export interface AmountFieldProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
  minMinor: bigint;
  maxMinor: bigint;
  /** Быстрые суммы в мажорных единицах. */
  presets?: number[];
  /** Кнопка «Всё» — доступный баланс в minor. */
  maxAvailableMinor?: bigint;
  maxAvailableLabel?: string;
  accent?: 'brand' | 'purple';
}

const AMOUNT_REGEX = /^\d{0,7}([.,]\d{0,2})?$/;

function formatMajor(minor: bigint): string {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const major = abs / 100n;
  const frac = abs % 100n;
  return `${negative ? '-' : ''}${major}.${frac.toString().padStart(2, '0')}`;
}

/**
 * Крупное поле ввода суммы: значение набирается прямо в «дисплее»,
 * под ним — чипы быстрых сумм и подсказка о лимитах.
 */
export function AmountField({
  value,
  onChange,
  label,
  disabled,
  minMinor,
  maxMinor,
  presets = [10, 25, 50, 100, 250],
  maxAvailableMinor,
  maxAvailableLabel = 'Всё',
  accent = 'brand',
}: AmountFieldProps): JSX.Element {
  const accentText = accent === 'brand' ? 'text-brand' : 'text-accent-purple';
  const accentRing =
    accent === 'brand'
      ? 'focus-within:border-brand/60 focus-within:shadow-[0_0_0_4px_rgba(0,255,136,0.10)]'
      : 'focus-within:border-accent-purple/60 focus-within:shadow-[0_0_0_4px_rgba(162,89,255,0.12)]';

  const limitsHint = useMemo(
    () => `${formatMajor(minMinor)} — ${formatMajor(maxMinor)} AZN`,
    [minMinor, maxMinor],
  );

  const chips = useMemo(() => {
    const min = Number(minMinor) / 100;
    const max = Number(maxMinor) / 100;
    return presets.filter((p) => p >= min && p <= max);
  }, [presets, minMinor, maxMinor]);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-text-muted">{label}</span>
        <span className="text-[11px] tabular-nums text-text-muted">{limitsHint}</span>
      </div>

      <div
        className={[
          'flex items-center gap-2 rounded-2xl border border-border bg-bg-base px-4 py-3 transition-all',
          accentRing,
          disabled ? 'opacity-60' : '',
        ].join(' ')}
      >
        <input
          type="text"
          inputMode="decimal"
          value={value}
          disabled={disabled}
          onChange={(e) => {
            const next = e.target.value;
            if (next === '' || AMOUNT_REGEX.test(next)) onChange(next);
          }}
          placeholder="0.00"
          aria-label={label}
          className="min-w-0 flex-1 bg-transparent text-3xl font-bold tabular-nums text-text-primary outline-none placeholder:text-text-muted/40"
        />
        <span className={`shrink-0 text-lg font-semibold ${accentText}`}>AZN</span>
      </div>

      {(chips.length > 0 || maxAvailableMinor !== undefined) && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {chips.map((p) => (
            <button
              key={p}
              type="button"
              disabled={disabled}
              onClick={() => onChange(String(p))}
              className="rounded-lg border border-border bg-bg-card px-3 py-1.5 text-xs font-semibold tabular-nums text-text-secondary transition-colors hover:border-border-strong hover:bg-bg-card-hover hover:text-text-primary disabled:opacity-50"
            >
              {p}
            </button>
          ))}
          {maxAvailableMinor !== undefined && maxAvailableMinor > 0n && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(formatMajor(maxAvailableMinor))}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                accent === 'brand'
                  ? 'border-brand/30 bg-brand/10 text-brand hover:bg-brand/20'
                  : 'border-accent-purple/30 bg-accent-purple/10 text-accent-purple hover:bg-accent-purple/20'
              }`}
            >
              {maxAvailableLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Конвертирует пользовательский ввод "12.34"/"12,34" в qəpik. */
export function parseAmountToMinor(input: string): bigint | null {
  const normalized = input.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [major, fraction = ''] = normalized.split('.');
  const padded = (fraction + '00').slice(0, 2);
  return BigInt(major!) * 100n + BigInt(padded);
}
