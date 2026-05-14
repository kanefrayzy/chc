import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 mb-6">
      <div className="flex flex-col gap-0.5">
        {back && <div className="mb-1">{back}</div>}
        <h1 className={cn('text-2xl font-bold text-ink-900 tracking-tight leading-tight')}>{title}</h1>
        {subtitle && <p className="text-sm text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2 pt-1">{actions}</div>}
    </header>
  );
}
