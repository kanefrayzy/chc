import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const toneClass: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-600',
  primary: 'bg-primary-tint text-primary-dark',
  success: 'bg-success/10 text-success-dark',
  warning: 'bg-warning/10 text-warning-dark',
  danger:  'bg-danger/10 text-danger-dark',
  info:    'bg-info/10 text-info-dark',
  accent:  'bg-accent/10 text-accent-dark',
};

export function Badge({
  tone = 'neutral',
  dot,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full',
        toneClass[tone],
        className,
      )}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full bg-current')} />}
      {children}
    </span>
  );
}
