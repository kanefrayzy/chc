'use client';

import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../utils/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const variantClasses: Record<NonNullable<CardProps['variant']>, string> = {
  default: 'bg-bg-card border border-border',
  elevated: 'bg-bg-card border border-border shadow-card',
  outlined: 'bg-transparent border border-border',
};

const paddingClasses: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-7',
};

export function Card({
  variant = 'default',
  padding = 'md',
  className,
  children,
  ...rest
}: CardProps): JSX.Element {
  return (
    <div
      className={cn('rounded-xl', variantClasses[variant], paddingClasses[padding], className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function CardHeader({
  title,
  description,
  actions,
  className,
  children,
  ...rest
}: CardHeaderProps): JSX.Element {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-4', className)} {...rest}>
      <div className="min-w-0">
        {title ? <h3 className="text-lg font-semibold text-text-primary">{title}</h3> : null}
        {description ? (
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
        ) : null}
        {children}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div className={cn('text-sm text-text-primary', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div className={cn('mt-5 flex items-center justify-end gap-2 border-t border-border pt-4', className)} {...rest}>
      {children}
    </div>
  );
}
