import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '../../../lib/cn';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'info';

const accentClass: Record<Tone, string> = {
  neutral: 'border-l-ink-300',
  primary: 'border-l-primary',
  success: 'border-l-success',
  warning: 'border-l-warning',
  info: 'border-l-info',
};

export function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
  href,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  href?: string;
}) {
  const inner = (
    <div
      className={cn(
        'bg-surface border border-border rounded-lg shadow-card px-5 py-4 border-l-4 transition-colors',
        accentClass[tone],
        href && 'hover:bg-elevated cursor-pointer',
      )}
    >
      <div className="text-xs uppercase tracking-wide text-ink-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-ink-900 font-mono tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-500">{hint}</div>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
