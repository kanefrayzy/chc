'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@chcgreen/ui';
import type { RouletteColor } from '@/lib/api/roulette';
import { ROULETTE_SLOTS } from '../constants';

// ── Иконки слотов (CSS-символы) ──────────────────────────────────────────────
const SLOT_ICONS: Record<RouletteColor, string> = {
  GREEN: '💣',
  RED: '⚔️',
  BLACK: '🦅',
};

// ── Цвета фона слотов ─────────────────────────────────────────────────────────
const SLOT_BG: Record<RouletteColor, string> = {
  GREEN: 'bg-brand',
  RED: 'bg-danger',
  BLACK: 'bg-[#1a2035]',
};

const SLOT_BORDER: Record<RouletteColor, string> = {
  GREEN: 'border-brand/60',
  RED: 'border-danger/60',
  BLACK: 'border-[#2a3350]',
};

// ── Сколько слотов показывать в «дуге» (нечётное для центра) ─────────────────
const VISIBLE = 7;

export interface RouletteWheelProps {
  winningSlot: number | null;
  status: 'BETTING' | 'ROLLING' | 'COMPLETED' | 'CANCELLED';
}

/** Полукруглое колесо: слоты идут по дуге, анимация прокрутки при spin */
export function RouletteWheel({ winningSlot, status }: RouletteWheelProps): JSX.Element {
  const total = ROULETTE_SLOTS.length; // 15
  const [offset, setOffset] = useState(0); // текущий «сдвиг» (индекс первого видимого)
  const [spinning, setSpinning] = useState(false);
  const prevStatus = useRef(status);
  const spinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Запускаем анимацию когда статус переходит в ROLLING
  useEffect(() => {
    if (prevStatus.current !== 'ROLLING' && status === 'ROLLING') {
      setSpinning(true);
      let frame = 0;
      const FRAMES = 30;
      const tick = (): void => {
        setOffset((o) => (o + 1) % total);
        frame++;
        const delay = frame < FRAMES * 0.5 ? 40 : frame < FRAMES * 0.8 ? 80 : 140;
        if (frame < FRAMES) {
          spinTimer.current = setTimeout(tick, delay);
        } else {
          setSpinning(false);
        }
      };
      tick();
    }
    if (status === 'COMPLETED' && winningSlot !== null) {
      // Snap к победному слоту (он будет в центре)
      const center = Math.floor(VISIBLE / 2);
      const newOffset = ((winningSlot - center) % total + total) % total;
      setOffset(newOffset);
    }
    prevStatus.current = status;
    return () => {
      if (spinTimer.current) clearTimeout(spinTimer.current);
    };
  }, [status, winningSlot, total]);

  // Строим видимые VISIBLE слотов с угловыми смещениями
  const visibleSlots = Array.from({ length: VISIBLE }, (_, i) => {
    const slotIdx = (offset + i) % total;
    return { idx: slotIdx, color: (ROULETTE_SLOTS[slotIdx] ?? 'BLACK') as RouletteColor };
  });

  const isCompleted = status === 'COMPLETED';

  return (
    <div className="relative flex flex-col items-center select-none">
      {/* Дуга слотов */}
      <div className="relative w-full max-w-[520px] h-[220px] mx-auto overflow-hidden">
        {/* Центральный указатель */}
        <div className="absolute top-0 left-1/2 z-20 -translate-x-1/2 flex flex-col items-center pointer-events-none">
          <div className="w-1 h-6 bg-text-primary rounded-b" />
          <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[12px] border-l-transparent border-r-transparent border-t-text-primary" />
        </div>

        {/* Слоты по дуге */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-end justify-center gap-2 px-2"
          style={{ width: '100%' }}>
          {visibleSlots.map(({ idx, color }, i) => {
            const center = Math.floor(VISIBLE / 2);
            const dist = Math.abs(i - center);
            // Угол наклона: центр = 0, края = ±30deg, поднятость по дуге
            const angle = (i - center) * 18; // deg
            const yLift = -(dist === 0 ? 0 : dist === 1 ? 20 : dist === 2 ? 55 : 95); // px вверх
            const scale = dist === 0 ? 1.18 : dist === 1 ? 1.05 : dist === 2 ? 0.92 : 0.8;
            const isWinner = isCompleted && idx === winningSlot;

            return (
              <div
                key={i}
                style={{
                  transform: `rotate(${angle}deg) translateY(${yLift}px) scale(${scale})`,
                  transition: spinning ? 'none' : 'transform 0.4s ease',
                  zIndex: VISIBLE - dist,
                }}
                className={cn(
                  'flex flex-col items-center justify-center rounded-xl border-2 text-white shadow-lg',
                  'w-[68px] h-[82px]',
                  SLOT_BG[color],
                  SLOT_BORDER[color],
                  isWinner && 'ring-4 ring-white ring-offset-2 ring-offset-bg-base shadow-[0_0_24px_rgba(255,255,255,0.4)]',
                )}
              >
                <span className="text-2xl leading-none">{SLOT_ICONS[color]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Статус/таймер зона */}
      {isCompleted && winningSlot !== null && winningSlot !== undefined && (
        <div className="mt-3 flex items-center gap-2 animate-[fadeIn_0.4s_ease]">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold',
              SLOT_BG[ROULETTE_SLOTS[winningSlot]!],
            )}
          >
            {SLOT_ICONS[ROULETTE_SLOTS[winningSlot]!]}{' '}
            {ROULETTE_SLOTS[winningSlot] === 'GREEN'
              ? 'GREEN ×14'
              : ROULETTE_SLOTS[winningSlot] === 'RED'
              ? 'RED ×2'
              : 'BLACK ×2'}
          </span>
        </div>
      )}
    </div>
  );
}

// ── ColorTotalsBadge ──────────────────────────────────────────────────────────

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
        'flex flex-col items-center justify-center rounded-xl border px-3 py-3 text-white gap-1',
        SLOT_BG[color],
        SLOT_BORDER[color],
      )}
    >
      <span className="text-lg font-extrabold">×{multiplier}</span>
      <span className="text-xs font-semibold opacity-90">{amountAzn} AZN</span>
      <span className="text-[10px] opacity-70">{betsCount} ставок</span>
    </div>
  );
}
