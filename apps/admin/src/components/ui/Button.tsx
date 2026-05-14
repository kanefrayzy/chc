import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
type Size = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variantClass: Record<Variant, string> = {
  primary:   'bg-primary text-white hover:bg-primary-dark shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:shadow-none',
  secondary: 'bg-white text-ink-700 border border-border hover:border-border-strong hover:bg-elevated shadow-sm active:scale-[0.98] disabled:opacity-50',
  outline:   'bg-transparent text-primary border border-primary/40 hover:bg-primary-tint hover:border-primary/70 disabled:opacity-50',
  ghost:     'bg-transparent text-ink-600 hover:bg-ink-100 hover:text-ink-900 disabled:opacity-50',
  danger:    'bg-danger text-white hover:bg-danger-dark shadow-sm active:scale-[0.98] disabled:opacity-50',
  success:   'bg-success text-white hover:bg-success-dark shadow-sm active:scale-[0.98] disabled:opacity-50',
};

const sizeClass: Record<Size, string> = {
  xs: 'h-6 px-2 text-xs rounded-md gap-1',
  sm: 'h-8 px-3 text-sm rounded-lg gap-1.5',
  md: 'h-9 px-4 text-sm rounded-lg gap-2',
  lg: 'h-11 px-5 text-base rounded-xl gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  leftIcon,
  rightIcon,
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
        'inline-flex items-center justify-center font-medium transition-all',
        variantClass[variant],
        sizeClass[size],
        className,
      )}
    >
      {loading
        ? <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-current border-r-transparent animate-spin" />
        : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
}
