'use client';

import { cn } from '@chcgreen/ui';
import type { RouletteColor } from '@/lib/api/roulette';
import { ROULETTE_SLOTS, COLOR_CLASSES } from '../constants';

export interface RouletteWheelProps {
  /** Слот-победитель (null если ещё не известен). */
  winningSlot: number | null;
  /** Текущий статус раунда для индикатора. */
  status: 'BETTING' | 'ROLLING' | 'COMPLETED' | 'CANCELLED';
}

export function RouletteWheel({ winningSlot, status }: RouletteWheelProps): JSX.Element {
  return (
    <div className="rounded-2xl border border-border bg-bg-card p-4">
      <div className="relative">
        <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1">
          <div className="h-0 w-0 border-l-[8px] border-r-[8px] border-t-[10px] border-l-transparent border-r-transparent border-t-text-primary" />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-2 pt-3">
          {ROULETTE_SLOTS.map((color, idx) => {
            const isWinner = winningSlot === idx && status === 'COMPLETED';
            return (
              <div
                key={idx}
                className={cn(
                  'flex h-16 w-12 shrink-0 items-center justify-center rounded-lg text-sm font-bold transition',
                  COLOR_CLASSES[color],
                  isWinner ? 'scale-110 ring-4 ring-brand' : '',
                )}
              >
                {idx}
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-text-muted">
        {status === 'ROLLING'
          ? '⟳ Крутимся…'
          : status === 'COMPLETED' && winningSlot !== null
          ? `Выпал слот ${winningSlot} (${ROULETTE_SLOTS[winningSlot]})`
          : status === 'BETTING'
          ? 'Принимаем ставки'
          : ''}
      </p>
    </div>
  );
}

export interface ColorTotalsBadgeProps {
  color: RouletteColor;
  amountMinor: string;
  betsCount: number;
  multiplier: number;
}

export function ColorTotalsBadge({
  color,
  amountMinor,
  betsCount,
  multiplier,
}: ColorTotalsBadgeProps): JSX.Element {
  const amountAzn = (Number(amountMinor) / 100).toFixed(2);
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold',
        COLOR_CLASSES[color],
      )}
    >
      <span>×{multiplier}</span>
      <span className="text-right">
        <div>{amountAzn} AZN</div>
        <div className="text-[10px] opacity-80">{betsCount} ставок</div>
      </span>
    </div>
  );
}
