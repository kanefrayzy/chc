import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
}

const variantClass: Record<Variant, string> = {
  primary:
    'bg-primary text-white hover:bg-primary-dark focus-visible:shadow-focus disabled:bg-primary/50',
  secondary:
    'bg-white text-ink-900 border border-border-strong hover:bg-elevated disabled:opacity-60',
  ghost:
    'bg-transparent text-ink-700 hover:bg-page disabled:opacity-50',
  danger:
    'bg-danger text-white hover:bg-danger/90 disabled:opacity-60',
  success:
    'bg-success text-white hover:bg-success/90 disabled:opacity-60',
};

const sizeClass: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm rounded-md',
  md: 'h-10 px-4 text-sm rounded-md',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  leftIcon,
  className,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-colors',
        variantClass[variant],
        sizeClass[size],
        className,
      )}
    >
      {loading ? <span className="inline-block w-3 h-3 rounded-full border-2 border-current border-r-transparent animate-spin" /> : leftIcon}
      {children}
    </button>
  );
}
