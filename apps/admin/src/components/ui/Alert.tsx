import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Tone = 'info' | 'success' | 'warning' | 'danger';

/** Тон задаётся цветом, а не значком — маркер оставлен текстовым. */
const toneConfig: Record<Tone, { bg: string; icon: string }> = {
  info:    { bg: 'bg-info/8 text-info-dark border-info/20',          icon: '' },
  success: { bg: 'bg-success/8 text-success-dark border-success/20', icon: '' },
  warning: { bg: 'bg-warning/8 text-warning-dark border-warning/20', icon: '' },
  danger:  { bg: 'bg-danger/8 text-danger-dark border-danger/20',    icon: '' },
};

export function Alert({
  tone = 'info',
  icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const cfg = toneConfig[tone];
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2.5 border rounded-xl px-4 py-3 text-sm font-medium',
        cfg.bg,
        className,
      )}
    >
      {(icon ?? cfg.icon) ? <span className="shrink-0 mt-px">{icon ?? cfg.icon}</span> : null}
      <div className="flex-1 leading-relaxed">{children}</div>
    </div>
  );
}

