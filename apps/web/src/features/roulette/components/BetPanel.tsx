'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { cn } from '@chcgreen/ui';
import { CrownIcon, CheckCircleIcon } from '@/components/icons';
import { parseAmountToMinor } from '@/features/deposits/components/AmountInput';
import { rouletteApi, type RouletteColor } from '@/lib/api/roulette';
import { ApiException } from '@/lib/api/client';
import { playClick } from '@/lib/sound';

const MIN_BET_MINOR = 100n;
const MAX_BET_MINOR = 50_000n;

const COLOR_LABELS: Record<RouletteColor, string> = {
  BLACK: 'Black',
  RED: 'Red',
  GREEN: 'Green',
};

export interface BetPanelProps {
  balanceMinor: string;
  disabled?: boolean;
  multipliers: Record<RouletteColor, number>;
  /** На какие цвета пользователь уже поставил в текущем раунде. */
  placedColors: RouletteColor[];
  onBetPlaced?: (color: RouletteColor, amountMinor: string) => void;
}

export function BetPanel({
  balanceMinor,
  disabled,
  multipliers,
  placedColors,
  onBetPlaced,
}: BetPanelProps): JSX.Element {
  const t = useTranslations('roulette.bet');
  const [amount, setAmount] = useState('');
  const [pendingColor, setPendingColor] = useState<RouletteColor | null>(null);
  const [isPending, startTransition] = useTransition();

  const balanceAzn = Number(balanceMinor) / 100;

  const placedSet = new Set(placedColors);
  const hasRed = placedSet.has('RED');
  const hasBlack = placedSet.has('BLACK');

  const adjustAmount = (fn: (cur: number) => number): void => {
    const cur = parseFloat(amount) || 0;
    const max = Number(MAX_BET_MINOR) / 100;
    const next = Math.max(0.01, Math.min(max, fn(cur)));
    setAmount(next.toFixed(2));
  };

  const isColorBlocked = (color: RouletteColor): boolean => {
    if (color === 'RED' && hasBlack) return true;
    if (color === 'BLACK' && hasRed) return true;
    return false;
  };

  const handleBet = (color: RouletteColor): void => {
    if (isColorBlocked(color)) {
      toast.error('Нельзя ставить на RED и BLACK одновременно. Разрешено только RED+GREEN или BLACK+GREEN.');
      return;
    }
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
        playClick();
        toast.success(`Ставка ${(Number(minor) / 100).toFixed(2)} AZN на ${COLOR_LABELS[color]} принята!`);
        // Поле НЕ сбрасываем — удобно повторить ставку.
        if (onBetPlaced) onBetPlaced(color, minor.toString());
      } catch (err) {
        let msg = t('errors.placeFailed');
        if (err instanceof ApiException) {
          if (err.message === 'NO_OPEN_ROUND') msg = t('errors.noOpenRound');
          else if (err.message === 'BETTING_CLOSED') msg = t('errors.bettingClosed');
          else if (err.message === 'INSUFFICIENT_FUNDS') msg = t('errors.insufficient');
          else if (err.message === 'INVALID_BET_COMBINATION')
            msg = 'Нельзя ставить на RED и BLACK одновременно';
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
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={disabled || isLoading}
            placeholder="0.00"
            className="w-full rounded-lg border border-border bg-bg-elevated pl-12 pr-3 py-3 text-base font-mono text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-50"
          />
        </div>
        <span className="text-xs text-text-muted whitespace-nowrap">Max. {Number(MAX_BET_MINOR) / 100}</span>
      </div>

      {/* Быстрые кнопки — две строки на мобильных */}
      <div className="grid grid-cols-4 gap-1.5 sm:flex sm:flex-wrap">
        {[1, 5, 10, 50].map((v) => (
          <button
            key={v}
            type="button"
            disabled={disabled || isLoading}
            onClick={() => adjustAmount((c) => c + v)}
            className="rounded-lg bg-bg-elevated border border-border py-2.5 text-sm font-semibold text-text-secondary hover:border-brand hover:text-brand active:scale-95 transition disabled:opacity-40"
          >
            +{v}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled || isLoading}
          onClick={() => adjustAmount((c) => c / 2)}
          className="rounded-lg bg-bg-elevated border border-border py-2.5 text-sm font-semibold text-text-secondary hover:border-brand hover:text-brand active:scale-95 transition disabled:opacity-40"
        >
          ½
        </button>
        <button
          type="button"
          disabled={disabled || isLoading}
          onClick={() => adjustAmount((c) => c * 2)}
          className="rounded-lg bg-bg-elevated border border-border py-2.5 text-sm font-semibold text-text-secondary hover:border-brand hover:text-brand active:scale-95 transition disabled:opacity-40"
        >
          ×2
        </button>
        <button
          type="button"
          disabled={disabled || isLoading}
          onClick={() => setAmount(balanceAzn.toFixed(2))}
          className="rounded-lg bg-bg-elevated border border-brand/40 py-2.5 text-sm font-semibold text-brand hover:bg-brand/10 active:scale-95 transition disabled:opacity-40"
        >
          MAX
        </button>
        <button
          type="button"
          disabled={disabled || isLoading}
          onClick={() => setAmount('')}
          className="rounded-lg bg-bg-elevated border border-border py-2.5 text-sm font-semibold text-text-muted hover:text-danger hover:border-danger active:scale-95 transition disabled:opacity-40"
        >
          CLR
        </button>
      </div>

      {/* Кнопки ставки: RED ─ GREEN ─ BLACK */}
      <div className="grid grid-cols-3 gap-2">
        {(['RED', 'GREEN', 'BLACK'] as RouletteColor[]).map((color) => {
          const mul = multipliers[color] ?? (color === 'GREEN' ? 14 : 2);
          const blocked = isColorBlocked(color);
          const isPlaced = placedSet.has(color);
          return (
            <button
              key={color}
              type="button"
              onClick={() => handleBet(color)}
              disabled={disabled || isLoading || blocked}
              title={blocked ? 'Нельзя ставить на RED и BLACK одновременно' : undefined}
              className={cn(
                'relative flex flex-col items-center justify-center gap-1 rounded-xl py-4 sm:py-3 font-bold transition',
                'border-2 min-h-[72px] sm:min-h-[60px] disabled:opacity-30 disabled:cursor-not-allowed active:scale-95',
                color === 'GREEN'
                  ? 'bg-gradient-to-b from-[#00ff88] to-[#00cc66] text-black border-brand hover:brightness-110 shadow-[0_0_20px_rgba(0,255,136,0.35)]'
                  : color === 'RED'
                  ? 'bg-gradient-to-b from-[#ff5470] to-[#cc2540] text-white border-danger/70 hover:brightness-110'
                  : 'bg-gradient-to-b from-[#2a3350] to-[#161d2c] text-white border-[#2a3350] hover:border-brand/40',
                pendingColor === color && 'ring-2 ring-white/50',
                isPlaced && 'ring-2 ring-yellow-300/80',
              )}
            >
              {color === 'GREEN' ? (
                <span className="absolute -top-2 text-warning drop-shadow-[0_0_4px_rgba(255,184,0,0.8)]">
                  <CrownIcon className="h-4 w-4" />
                </span>
              ) : null}
              <span className="text-sm font-extrabold uppercase tracking-wide">{color}</span>
              <span className="text-xs opacity-90">×{mul}</span>
              {isPlaced ? (
                <span className="absolute bottom-1 right-1 rounded bg-black/40 px-1 text-white">
                  <CheckCircleIcon className="h-3 w-3" />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Подсказка о правиле */}
      <p className="text-[11px] text-text-muted text-center">
        Доступны комбинации: <span className="text-text-secondary font-semibold">RED + GREEN</span> или{' '}
        <span className="text-text-secondary font-semibold">BLACK + GREEN</span>
      </p>
    </div>
  );
}
