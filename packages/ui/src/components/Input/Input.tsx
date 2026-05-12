'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid = false, className, type = 'text', ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(
        'h-11 w-full rounded-lg border bg-bg-elevated px-4 text-sm text-text-primary',
        'placeholder:text-text-muted',
        'transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-base',
        invalid
          ? 'border-danger focus:border-danger focus:ring-danger/40'
          : 'border-border focus:border-brand focus:ring-brand/40',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...rest}
    />
  );
});
