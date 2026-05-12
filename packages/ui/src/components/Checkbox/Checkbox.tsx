'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../utils/cn';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, className, id, ...rest },
  ref,
) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'inline-flex cursor-pointer items-start gap-2 text-sm text-text-secondary',
        className,
      )}
    >
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className={cn(
          'mt-0.5 h-4 w-4 rounded border-border bg-bg-elevated',
          'text-brand focus:ring-2 focus:ring-brand/40 focus:ring-offset-0',
        )}
        {...rest}
      />
      {label ? <span>{label}</span> : null}
    </label>
  );
});
