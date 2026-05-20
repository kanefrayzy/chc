'use client';

import { useMemo } from 'react';
import { cn } from '@chcgreen/ui';
import type { MinesGameDto } from '@/lib/api/mines';

export interface MinesGridProps {
  game: MinesGameDto | null;
  /** Размер сетки (по умолчанию 5). */
  totalTiles?: number;
  gridSize?: number;
  /** Локально открываемые сейчас клетки (для оптимистичной анимации до ответа сервера). */
  pendingTile: number | null;
  disabled: boolean;
  onReveal: (tile: number) => void;
  /** Подсветить мину, на которой игрок взорвался (если состояние BUSTED). */
  bustedTile: number | null;
  /** URL пользовательской иконки кристалла. Пусто — встроенный SVG. */
  gemIconUrl?: string;
  /** URL пользовательской иконки бомбы. Пусто — встроенный SVG. */
  bombIconUrl?: string;
  /** Режим выбора клеток (для auto-режима до старта серии). */
  selectionMode?: boolean;
  /** Выбранные клетки (для подсветки). */
  selectedTiles?: number[];
  /** Переключить выбор клетки. */
  onToggleSelect?: (tile: number) => void;
}

type TileVisualState = 'hidden' | 'selected' | 'revealed-gem' | 'final-gem' | 'revealed-mine' | 'busted-mine' | 'pending';

export function MinesGrid({
  game,
  totalTiles = 25,
  gridSize = 5,
  pendingTile,
  disabled,
  onReveal,
  bustedTile,
  gemIconUrl,
  bombIconUrl,
  selectionMode = false,
  selectedTiles,
  onToggleSelect,
}: MinesGridProps): JSX.Element {
  const revealedSet = useMemo(() => new Set(game?.revealedTiles ?? []), [game?.revealedTiles]);
  const mineSet = useMemo(() => new Set(game?.minePositions ?? []), [game?.minePositions]);
  const selectedSet = useMemo(() => new Set(selectedTiles ?? []), [selectedTiles]);
  const isCompleted = game ? game.status !== 'ACTIVE' : false;

  const stateFor = (idx: number): TileVisualState => {
    if (idx === bustedTile) return 'busted-mine';
    if (revealedSet.has(idx)) return 'revealed-gem';
    if (isCompleted && mineSet.has(idx)) return 'revealed-mine';
    if (isCompleted) return 'final-gem';
    if (idx === pendingTile) return 'pending';
    if (selectionMode && selectedSet.has(idx)) return 'selected';
    return 'hidden';
  };

  const handleClick = (idx: number): void => {
    if (selectionMode) {
      if (revealedSet.has(idx)) return;
      onToggleSelect?.(idx);
      return;
    }
    if (disabled) return;
    if (revealedSet.has(idx)) return;
    onReveal(idx);
  };

  return (
    <div
      className="grid w-full max-w-[640px] gap-2 sm:gap-2.5"
      style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
      role="grid"
      aria-label="Mines grid"
    >
      {Array.from({ length: totalTiles }, (_, idx) => {
        const s = stateFor(idx);
        const interactive = selectionMode ? !revealedSet.has(idx) : !disabled && s === 'hidden';
        return (
          <button
            key={idx}
            type="button"
            role="gridcell"
            disabled={!interactive}
            onClick={() => handleClick(idx)}
            aria-label={`Tile ${idx + 1}`}
            aria-pressed={s === 'selected' || undefined}
            className={cn(
              'group relative aspect-square select-none rounded-xl border transition-all duration-200',
              // визуальные состояния
              s === 'hidden' && 'border-border bg-[#1f2a3a] shadow-[inset_0_-3px_0_rgba(0,0,0,0.25)] hover:border-brand hover:bg-[#243245] active:scale-[0.97]',
              s === 'selected' && 'border-brand bg-[#1f2a3a] shadow-[inset_0_-3px_0_rgba(0,0,0,0.25),0_0_18px_rgba(0,255,140,0.35)] ring-2 ring-brand/50 hover:bg-[#243245] active:scale-[0.97]',
              s === 'pending' && 'border-brand/60 bg-[#243245] animate-pulse',
              s === 'revealed-gem' && 'border-brand/40 bg-gradient-to-br from-[#0e2e23] to-[#0a3a2d] shadow-[0_0_22px_rgba(0,255,140,0.18)] scale-[1.02]',
              s === 'final-gem' && 'border-brand/20 bg-gradient-to-br from-[#0e2e23]/60 to-[#0a3a2d]/60 opacity-70',
              s === 'revealed-mine' && 'border-danger/40 bg-gradient-to-br from-[#3a1116] to-[#240a0e] opacity-70',
              s === 'busted-mine' && 'border-danger bg-gradient-to-br from-[#7a1626] to-[#3a0a14] shadow-[0_0_26px_rgba(255,59,92,0.55)] animate-[pulse_0.6s_ease-out_1]',
              !interactive && s === 'hidden' && 'opacity-60',
            )}
          >
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-2xl sm:text-3xl">
              {s === 'revealed-gem' ? (
                <GemGlyph iconUrl={gemIconUrl} />
              ) : s === 'final-gem' ? (
                <GemGlyph iconUrl={gemIconUrl} dim />
              ) : s === 'revealed-mine' || s === 'busted-mine' ? (
                <BombGlyph emphasized={s === 'busted-mine'} iconUrl={bombIconUrl} />
              ) : s === 'selected' ? (
                <span className="h-2.5 w-2.5 rounded-full bg-brand shadow-[0_0_10px_rgba(0,255,140,0.7)]" />
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function GemGlyph({ iconUrl, dim = false }: { iconUrl?: string; dim?: boolean }): JSX.Element {
  if (iconUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={iconUrl}
        alt="gem"
        className={cn(
          'h-7 w-7 object-contain drop-shadow-[0_0_8px_rgba(0,255,140,0.55)] sm:h-9 sm:w-9',
          dim && 'opacity-60 drop-shadow-none',
        )}
      />
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={cn('h-7 w-7 sm:h-9 sm:w-9', dim ? 'opacity-60' : 'drop-shadow-[0_0_8px_rgba(0,255,140,0.55)]')} aria-hidden="true">
      <defs>
        <linearGradient id="gem-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00ffae" />
          <stop offset="100%" stopColor="#00b272" />
        </linearGradient>
      </defs>
      <path
        d="M12 2 L20 9 L12 22 L4 9 Z"
        fill="url(#gem-grad)"
        stroke="#00ffae"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path d="M4 9 H20 M12 2 V22 M8 9 L12 22 M16 9 L12 22" stroke="#062a1c" strokeWidth="0.6" fill="none" opacity="0.6" />
    </svg>
  );
}

function BombGlyph({ emphasized, iconUrl }: { emphasized: boolean; iconUrl?: string }): JSX.Element {
  if (iconUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={iconUrl}
        alt="mine"
        className={cn(
          'h-7 w-7 object-contain sm:h-9 sm:w-9',
          emphasized && 'drop-shadow-[0_0_10px_rgba(255,59,92,0.85)]',
        )}
      />
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('h-7 w-7 sm:h-9 sm:w-9', emphasized && 'drop-shadow-[0_0_10px_rgba(255,59,92,0.85)]')}
      aria-hidden="true"
    >
      <circle cx="11" cy="14" r="7" fill="#1a1f2b" stroke="#ff3b5c" strokeWidth="1.5" />
      <path d="M17 8 L20 5" stroke="#ff3b5c" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="20" cy="5" r="1.5" fill="#ffb648" />
      <path d="M9 12 L11 14" stroke="#ffd5dc" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
