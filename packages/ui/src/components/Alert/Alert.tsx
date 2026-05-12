'use client';

import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../utils/cn';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: AlertVariant;
  title?: ReactNode;
}

const variantClasses: Record<AlertVariant, string> = {
  info: 'border-border bg-bg-elevated text-text-primary',
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  danger: 'border-danger/30 bg-danger/10 text-danger',
};

export function Alert({ variant = 'info', title, className, children, ...rest }: AlertProps): JSX.Element {
  return (
    <div
      role={variant === 'danger' || variant === 'warning' ? 'alert' : 'status'}
      className={cn('rounded-lg border px-4 py-3 text-sm', variantClasses[variant], className)}
      {...rest}
    >
      {title ? <div className="font-semibold">{title}</div> : null}
      {children ? <div className={cn(title && 'mt-1 text-text-primary')}>{children}</div> : null}
    </div>
  );
}
