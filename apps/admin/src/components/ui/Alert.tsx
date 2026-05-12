import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Tone = 'info' | 'success' | 'warning' | 'danger';

const toneClass: Record<Tone, string> = {
  info: 'bg-info-tint text-info border-info/20',
  success: 'bg-success-tint text-success border-success/20',
  warning: 'bg-warning-tint text-warning border-warning/20',
  danger: 'bg-danger-tint text-danger border-danger/20',
};

export function Alert({
  tone = 'info',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'border rounded-md px-4 py-2.5 text-sm',
        toneClass[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}
