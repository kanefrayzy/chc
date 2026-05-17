'use client';

import { cn } from '@chcgreen/ui';
import type { MessageDto } from '@/lib/api/tickets';

export interface MessageBubbleProps {
  message: MessageDto;
  locale: string;
}

export function MessageBubble({ message, locale }: MessageBubbleProps): JSX.Element {
  if (message.kind === 'SYSTEM') {
    return (
      <div className="my-2 text-center text-xs text-text-muted">
        {message.body}
      </div>
    );
  }
  const mine = message.isMine;
  return (
    <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2 text-sm',
          mine ? 'bg-brand text-bg-base' : 'bg-bg-elevated text-text-primary',
        )}
      >
        {message.kind === 'FILE' ? (
          <a href={message.body} target="_blank" rel="noopener noreferrer">
            <img
              src={message.body}
              alt="Изображение"
              className="max-w-[260px] max-h-[260px] rounded-lg cursor-pointer object-contain"
            />
          </a>
        ) : (
          <div className="whitespace-pre-wrap break-words">{message.body}</div>
        )}
        <div className={cn('mt-1 text-[10px]', mine ? 'text-bg-base/70' : 'text-text-muted')}>
          {new Date(message.createdAt).toLocaleTimeString(
            locale === 'az' ? 'az-AZ' : 'ru-RU',
            { hour: '2-digit', minute: '2-digit' },
          )}
        </div>
      </div>
    </div>
  );
}
