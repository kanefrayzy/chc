import type { InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'w-full h-9 px-3 rounded-lg bg-surface border border-border text-sm text-ink-900',
        'placeholder:text-ink-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10',
        'disabled:bg-page disabled:text-ink-400 transition-shadow',
        props.className,
      )}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        'w-full min-h-[80px] px-3 py-2.5 rounded-lg bg-surface border border-border text-sm text-ink-900',
        'placeholder:text-ink-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10',
        'disabled:bg-page disabled:text-ink-400 resize-y transition-shadow',
        props.className,
      )}
    />
  );
}
