'use client';

import { cn } from '@chcgreen/ui';
import type { WithdrawalMethod } from '@/lib/api/withdrawals';

export interface WithdrawMethodOption {
  id: WithdrawalMethod;
  label: string;
  description: string;
}

export interface WithdrawMethodSelectorProps {
  options: readonly WithdrawMethodOption[];
  value: WithdrawalMethod;
  onChange: (value: WithdrawalMethod) => void;
  disabled?: boolean;
}

export function WithdrawMethodSelector({
  options,
  value,
  onChange,
  disabled = false,
}: WithdrawMethodSelectorProps): JSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-3" role="radiogroup">
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
              selected ? 'border-brand bg-bg-card-hover' : 'border-border hover:border-border-strong',
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
