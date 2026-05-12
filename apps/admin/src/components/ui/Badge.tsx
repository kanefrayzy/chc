import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const toneClass: Record<Tone, string> = {
  neutral: 'bg-page text-ink-700 border-border',
  primary: 'bg-primary-tint text-primary-dark border-primary/20',
  success: 'bg-success-tint text-success border-success/20',
  warning: 'bg-warning-tint text-warning border-warning/20',
  danger: 'bg-danger-tint text-danger border-danger/20',
  info: 'bg-info-tint text-info border-info/20',
  accent: 'bg-accent-tint text-accent-dark border-accent/20',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border',
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
