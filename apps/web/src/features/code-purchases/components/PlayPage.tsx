'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useLocale } from 'next-intl';
import { TicketIcon } from '@/components/icons';
import { codePurchasesApi } from '@/lib/api/code-purchases';
import { ApiException } from '@/lib/api/client';
import { useUi } from '@/components/layout/ui-context';

interface PlayPageProps {
  casinoUrl: string;
}

export function PlayPage({ casinoUrl: _casinoUrl }: PlayPageProps): JSX.Element {
  const locale = useLocale();
  const { toggleChat, chatOpen } = useUi();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isBuying, startBuying] = useTransition();

  const handleInput = (val: string): void => {
    // Только цифры, максимум 14
    const digits = val.replace(/\D/g, '').slice(0, 14);
    setCode(digits);
    setError(null);
  };

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    if (code.length !== 14) {
      setError('Введите 14-значный код');
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch(`/${locale}/play/activate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        const data = (await res.json()) as {
          result?: string;
          text?: string;
          menu?: string;
          redirect?: string;
        };

        if (data.result === 'OK') {
          const target = data.menu ?? data.redirect;
          if (target) {
            const url = target.startsWith('http') ? target : `https://fastloto.com${target}`;
            window.open(url, '_blank', 'noopener');
          }
          setCode('');
        } else {
          setError(data.text ?? 'Неверный код. Проверьте и попробуйте снова.');
        }
      } catch {
        setError('Ошибка соединения. Попробуйте позже.');
      }
    });
  };

  // Форматируем 14 цифр как XX-XX-XX-XX-XX-XX-XX
  const formatted = code.replace(/(\d{2})(?=\d)/g, '$1-');

  return (
    <div className="flex items-center justify-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-bg-card p-6 sm:p-7">
        {/* Header */}
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand/15 text-brand">
            <TicketIcon className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary">Ввести код</h2>
          <p className="text-sm text-text-secondary">14-значный код от модератора</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <input
            id="game-code"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            value={formatted}
            onChange={(e) => handleInput(e.target.value)}
            disabled={isPending}
            placeholder="XX-XX-XX-XX-XX-XX-XX"
            className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-3 text-center font-mono text-base tracking-[0.15em] text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-50"
            maxLength={20}
          />

          {error && (
            <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending || code.length !== 14}
            className="w-full rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-bg-base transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Проверяем…' : 'Играть'}
          </button>
        </form>

        {/* Buy code CTA */}
        <button
          type="button"
          disabled={isBuying}
          onClick={() => {
            setBuyError(null);
            startBuying(async () => {
              try {
                await codePurchasesApi.create({});
                if (!chatOpen) toggleChat();
              } catch (err) {
                setBuyError(
                  err instanceof ApiException
                    ? err.message
                    : 'Не удалось открыть тикет. Попробуйте позже.',
                );
              }
            });
          }}
          className="mt-3 w-full rounded-xl border border-border bg-transparent px-6 py-2.5 text-sm font-medium text-text-primary transition-colors hover:border-brand/60 hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isBuying ? 'Открываем чат…' : 'Купить код у модератора'}
        </button>
        {buyError && <p className="mt-2 text-center text-xs text-danger">{buyError}</p>}
      </div>
    </div>
  );
}
