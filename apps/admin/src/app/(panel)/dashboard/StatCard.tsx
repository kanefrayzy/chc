import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '../../../lib/cn';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'info';

const toneConfig: Record<Tone, { gradient: string; dot: string }> = {
  neutral: { gradient: 'from-ink-100 to-ink-50',      dot: 'bg-ink-400' },
  primary: { gradient: 'from-primary-tint to-white',  dot: 'bg-primary' },
  success: { gradient: 'from-success/10 to-white',    dot: 'bg-success' },
  warning: { gradient: 'from-warning/10 to-white',    dot: 'bg-warning' },
  info:    { gradient: 'from-info/10 to-white',       dot: 'bg-info' },
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
  const cfg = toneConfig[tone];
  const inner = (
    <div
      className={cn(
        'relative bg-surface border border-border rounded-2xl px-6 py-5 shadow-card overflow-hidden transition-all',
        href && 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer',
      )}
    >
      {/* Gradient accent */}
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-40', cfg.gradient)} />
      {/* Dot indicator */}
      <div className={cn('absolute top-4 right-4 w-2.5 h-2.5 rounded-full', cfg.dot)} />
      <div className="relative">
        <div className="text-xs font-semibold uppercase tracking-widest text-ink-400 mb-2">{label}</div>
        <div className="text-3xl font-bold text-ink-900 font-mono tabular-nums leading-none">{value}</div>
        {hint && <div className="mt-1.5 text-xs text-ink-500">{hint}</div>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
