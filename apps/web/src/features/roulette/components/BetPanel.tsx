'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { cn } from '@chcgreen/ui';
import { AmountInput, parseAmountToMinor } from '@/features/deposits/components/AmountInput';
import { rouletteApi, type RouletteColor } from '@/lib/api/roulette';
import { ApiException } from '@/lib/api/client';
import { COLOR_CLASSES } from '../constants';

const MIN_BET_MINOR = 100n; // 1 AZN
const MAX_BET_MINOR = 50_000n; // 500 AZN

// Иконки по цвету (как на скриншоте)
const COLOR_ICONS: Record<RouletteColor, string> = {
  BLACK: '🦅',
  RED: '⚔️',
  GREEN: '💣',
};

const COLOR_LABELS: Record<RouletteColor, string> = {
  BLACK: 'Black',
  RED: 'Red',
  GREEN: 'Green',
};

export interface BetPanelProps {
  balanceMinor: string;
  disabled?: boolean;
  multipliers: Record<RouletteColor, number>;
}

export function BetPanel({ balanceMinor, disabled, multipliers }: BetPanelProps): JSX.Element {
  const t = useTranslations('roulette.bet');
  const [amount, setAmount] = useState('');
  const [pendingColor, setPendingColor] = useState<RouletteColor | null>(null);
  const [isPending, startTransition] = useTransition();

  const balanceAzn = Number(balanceMinor) / 100;

  const adjustAmount = (fn: (cur: number) => number): void => {
    const cur = parseFloat(amount) || 0;
    const next = Math.max(0.01, Math.min(MAX_BET_MINOR / 100n > 0 ? Number(MAX_BET_MINOR) / 100 : 9999, fn(cur)));
    setAmount(next.toFixed(2));
  };

  const handleBet = (color: RouletteColor): void => {
    const minor = parseAmountToMinor(amount);
    if (minor === null) {
      toast.error(t('errors.invalidAmount'));
      return;
    }
    if (minor < MIN_BET_MINOR || minor > MAX_BET_MINOR) {
      toast.error(t('errors.outOfRange'));
      return;
    }
    if (minor > BigInt(balanceMinor)) {
      toast.error(t('errors.insufficient'));
      return;
    }

    setPendingColor(color);
    startTransition(async () => {
      try {
        await rouletteApi.placeBet({ color, amountMinor: minor.toString() });
        toast.success(`Ставка ${(Number(minor) / 100).toFixed(2)} AZN на ${COLOR_LABELS[color]} принята!`);
        setAmount('');
      } catch (err) {
        let msg = t('errors.placeFailed');
        if (err instanceof ApiException) {
          if (err.message === 'NO_OPEN_ROUND') msg = t('errors.noOpenRound');
          else if (err.message === 'BETTING_CLOSED') msg = t('errors.bettingClosed');
          else if (err.message === 'INSUFFICIENT_FUNDS') msg = t('errors.insufficient');
          else msg = err.message || msg;
        }
        toast.error(msg);
      } finally {
        setPendingColor(null);
      }
    });
  };

  const isLoading = isPending;

  return (
    <div className="rounded-2xl border border-border bg-bg-card p-4 space-y-3">
      {/* Поле ввода суммы */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text-muted font-semibold">AZN</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={disabled || isLoading}
            placeholder="0.00"
            className="w-full rounded-lg border border-border bg-bg-elevated pl-12 pr-3 py-2.5 text-sm font-mono text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-50"
          />
        </div>
        <span className="text-xs text-text-muted whitespace-nowrap">Max. {Number(MAX_BET_MINOR) / 100}</span>
      </div>

      {/* Быстрые кнопки как на скриншоте */}
      <div className="flex flex-wrap gap-1.5">
        {[1, 5, 10, 50].map((v) => (
          <button
            key={v}
            type="button"
            disabled={disabled || isLoading}
            onClick={() => adjustAmount((c) => c + v)}
            className="rounded-md bg-bg-elevated border border-border px-2.5 py-1 text-xs font-semibold text-text-secondary hover:border-brand hover:text-brand transition disabled:opacity-40"
          >
            +{v}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled || isLoading}
          onClick={() => adjustAmount((c) => c / 2)}
          className="rounded-md bg-bg-elevated border border-border px-2.5 py-1 text-xs font-semibold text-text-secondary hover:border-brand hover:text-brand transition disabled:opacity-40"
        >
          1/2
        </button>
        <button
          type="button"
          disabled={disabled || isLoading}
          onClick={() => adjustAmount((c) => c * 2)}
          className="rounded-md bg-bg-elevated border border-border px-2.5 py-1 text-xs font-semibold text-text-secondary hover:border-brand hover:text-brand transition disabled:opacity-40"
        >
          ×2
        </button>
        <button
          type="button"
          disabled={disabled || isLoading}
          onClick={() => setAmount(balanceAzn.toFixed(2))}
          className="rounded-md bg-bg-elevated border border-border px-2.5 py-1 text-xs font-semibold text-text-secondary hover:border-brand hover:text-brand transition disabled:opacity-40"
        >
          Всё
        </button>
        <button
          type="button"
          disabled={disabled || isLoading}
          onClick={() => setAmount('')}
          className="rounded-md bg-bg-elevated border border-border px-2.5 py-1 text-xs font-semibold text-text-muted hover:text-danger hover:border-danger transition disabled:opacity-40"
        >
          Сбр.
        </button>
      </div>

      {/* Кнопки ставки по цвету */}
      <div className="grid grid-cols-4 gap-2">
        {(['BLACK', 'RED', 'GREEN'] as RouletteColor[]).map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => handleBet(color)}
            disabled={disabled || isLoading}
            className={cn(
              'col-span-1 flex flex-col items-center justify-center gap-1 rounded-xl py-3 font-bold transition',
              'border-2 border-transparent disabled:opacity-40',
              color === 'GREEN'
                ? 'col-span-1 bg-brand text-black border-brand/60 hover:brightness-110'
                : color === 'RED'
                ? 'bg-danger text-white border-danger/60 hover:brightness-110'
                : 'bg-[#1a2035] text-white border-[#2a3350] hover:border-brand/40',
              pendingColor === color && 'ring-2 ring-white/40',
            )}
          >
            <span className="text-lg">{COLOR_ICONS[color]}</span>
            <span className="text-xs font-semibold">Place a bet</span>
            <span className="text-[11px] opacity-80">×{multipliers[color]}</span>
          </button>
        ))}
        {/* Джокер слот (черно-синий x7 как на скрине) */}
        <button
          type="button"
          disabled
          className="col-span-1 flex flex-col items-center justify-center gap-1 rounded-xl py-3 font-bold bg-[#1a1f3a] text-text-muted border-2 border-[#2a3350] opacity-50 cursor-not-allowed"
        >
          <span className="text-lg">🃏</span>
          <span className="text-xs font-semibold">Jackpot</span>
          <span className="text-[11px]">×7</span>
        </button>
      </div>
    </div>
  );
}
