'use client';

import { useState, useTransition, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@chcgreen/ui';

export interface MessageComposerProps {
  onSend: (body: string) => Promise<void>;
  disabled?: boolean;
}

export function MessageComposer({ onSend, disabled }: MessageComposerProps): JSX.Element {
  const t = useTranslations('chat.composer');
  const [value, setValue] = useState('');
  const [isPending, startTransition] = useTransition();

  const submit = (): void => {
    const trimmed = value.trim();
    if (!trimmed) return;
    startTransition(async () => {
      await onSend(trimmed);
      setValue('');
    });
  };

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    submit();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-border p-3">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled || isPending}
        placeholder={t('placeholder')}
        rows={2}
        className="flex-1 resize-none rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none disabled:opacity-50"
      />
      <Button type="submit" variant="primary" disabled={disabled || isPending || !value.trim()}>
        {isPending ? t('sending') : t('send')}
      </Button>
    </form>
  );
}
