import type { InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'w-full h-10 px-3 rounded-md bg-surface border border-border text-sm text-ink-900',
        'placeholder:text-ink-300 focus:outline-none focus:border-primary focus:shadow-focus',
        'disabled:bg-page disabled:text-ink-400',
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
        'w-full min-h-[80px] px-3 py-2 rounded-md bg-surface border border-border text-sm text-ink-900',
        'placeholder:text-ink-300 focus:outline-none focus:border-primary focus:shadow-focus',
        'disabled:bg-page disabled:text-ink-400 resize-y',
        props.className,
      )}
    />
  );
}
