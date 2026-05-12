import { cn } from '@chcgreen/ui';
import type { RouletteColor } from '@/lib/api/roulette';

// ВАЖНО: должно совпадать с apps/api/src/modules/roulette/roulette.constants.ts (slotToColor)
//   0 — GREEN, нечётные — RED, чётные ≠ 0 — BLACK
export const ROULETTE_SLOTS: RouletteColor[] = Array.from({ length: 15 }, (_, i) => {
  if (i === 0) return 'GREEN';
  return i % 2 === 1 ? 'RED' : 'BLACK';
});

export const COLOR_CLASSES: Record<RouletteColor, string> = {
  BLACK: 'bg-bg-elevated text-text-primary',
  RED: 'bg-danger text-bg-base',
  GREEN: 'bg-brand text-bg-base',
};

export const COLOR_DOT_CLASSES: Record<RouletteColor, string> = {
  BLACK: 'bg-bg-elevated border border-border',
  RED: 'bg-danger',
  GREEN: 'bg-brand',
};

export function colorClass(color: RouletteColor, extra?: string): string {
  return cn(COLOR_CLASSES[color], extra);
}
