import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Card({
  children,
  className,
  title,
  subtitle,
  action,
  padding = true,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  padding?: boolean;
}) {
  return (
    <div className={cn('bg-surface border border-border rounded-xl shadow-card', className)}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-border">
          <div>
            {title && <h2 className="text-base font-semibold text-ink-900">{title}</h2>}
            {subtitle && <p className="text-sm text-ink-500 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn(padding && 'px-6 py-5')}>{children}</div>
    </div>
  );
}
