import type { RouletteColor } from '@prisma/client';

/**
 * Классическая рулетка 15 слотов:
 *   0 — GREEN (×14)
 *   1..7 — RED (×2)
 *   8..14 — BLACK (×2)
 */
export const ROULETTE_TOTAL_SLOTS = 15;

export const PAYOUT_MULTIPLIER: Record<RouletteColor, number> = {
  GREEN: 14,
  RED: 2,
  BLACK: 2,
};

export function slotToColor(slot: number): RouletteColor {
  if (slot === 0) return 'GREEN';
  if (slot >= 1 && slot <= 7) return 'RED';
  if (slot >= 8 && slot <= 14) return 'BLACK';
  throw new Error(`Invalid slot ${slot}`);
}

export function calculatePayout(amountMinor: bigint, color: RouletteColor): bigint {
  const mult = BigInt(PAYOUT_MULTIPLIER[color]);
  return amountMinor * mult;
}
