import { cn } from '@chcgreen/ui';
import type { RouletteColor } from '@/lib/api/roulette';

export const ROULETTE_SLOTS: RouletteColor[] = [
  'GREEN',
  'RED', 'RED', 'RED', 'RED', 'RED', 'RED', 'RED',
  'BLACK', 'BLACK', 'BLACK', 'BLACK', 'BLACK', 'BLACK', 'BLACK',
];

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
