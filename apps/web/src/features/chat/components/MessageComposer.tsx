'use client';

import { useState, useRef, useCallback, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@chcgreen/ui';

export interface MessageComposerProps {
  onSend: (body: string) => Promise<void>;
  onUploadImage?: (file: File) => Promise<void>;
  disabled?: boolean;
  onTypingChange?: (isTyping: boolean) => void;
}

export function MessageComposer({ onSend, onUploadImage, disabled, onTypingChange }: MessageComposerProps): JSX.Element {
  const t = useTranslations('chat.composer');
  const [value, setValue] = useState('');
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Защита от двойного клика — ref обновляется синхронно, в отличие от state */
  const submittingRef = useRef(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emitTyping = useCallback((isTyping: boolean) => {
    onTypingChange?.(isTyping);
    if (isTyping) {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => onTypingChange?.(false), 3000);
    }
  }, [onTypingChange]);

  const handleChange = (v: string) => {
    setValue(v);
    emitTyping(v.length > 0);
  };

  const submit = (): void => {
    if (submittingRef.current) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    submittingRef.current = true;
    setPending(true);
    emitTyping(false);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    onSend(trimmed)
      .then(() => { setValue(''); })
      .finally(() => {
        submittingRef.current = false;
        setPending(false);
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

  const handlePickFile = (): void => {
    setUploadError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    e.target.value = ''; // сброс — чтобы повторно выбрать тот же файл
    if (!file || !onUploadImage) return;
    if (!file.type.startsWith('image/')) {
      setUploadError(t('imageOnly'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError(t('imageTooLarge'));
      return;
    }
    setUploadError(null);
    setUploading(true);
    onUploadImage(file)
      .catch((err) => {
        setUploadError(err instanceof Error ? err.message : t('uploadFailed'));
      })
      .finally(() => setUploading(false));
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-border p-3">
      {uploadError && <div className="mb-2 text-xs text-danger">{uploadError}</div>}
      <div className="flex items-end gap-2">
        {onUploadImage && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={handlePickFile}
              disabled={disabled || uploading}
              title={t('attachImage')}
              aria-label={t('attachImage')}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-bg-elevated text-text-secondary transition hover:text-text-primary disabled:opacity-50"
            >
              {uploading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              )}
            </button>
          </>
        )}
        <textarea
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || pending}
          placeholder={t('placeholder')}
          rows={2}
          className="flex-1 resize-none rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none disabled:opacity-50"
        />
        <Button type="submit" variant="primary" disabled={disabled || pending || !value.trim()}>
          {pending ? t('sending') : t('send')}
        </Button>
      </div>
    </form>
  );
}
