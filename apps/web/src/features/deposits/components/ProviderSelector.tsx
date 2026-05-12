'use client';

import { Card, CardBody } from '@chcgreen/ui';
import { cn } from '@chcgreen/ui';
import type { PaymentProviderId } from '@/lib/api/deposits';

export interface ProviderOption {
  id: PaymentProviderId;
  label: string;
  description: string;
}

export interface ProviderSelectorProps {
  options: readonly ProviderOption[];
  value: PaymentProviderId;
  onChange: (value: PaymentProviderId) => void;
  disabled?: boolean;
}

export function ProviderSelector({
  options,
  value,
  onChange,
  disabled = false,
}: ProviderSelectorProps): JSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-2" role="radiogroup">
      {options.map((opt) => {
        const selected = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(opt.id)}
            className={cn(
              'rounded-xl border p-4 text-left transition focus:outline-none',
              selected
                ? 'border-brand bg-bg-card-hover'
                : 'border-border hover:border-border-strong',
              disabled && 'opacity-50',
            )}
          >
            <div className="text-sm font-semibold text-text-primary">{opt.label}</div>
            <div className="mt-1 text-xs text-text-secondary">{opt.description}</div>
          </button>
        );
      })}
    </div>
  );
}
