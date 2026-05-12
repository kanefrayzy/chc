import type { RouletteColor } from '@prisma/client';

/**
 * Рулетка 15 слотов с чередованием RED/BLACK для аккуратного вида:
 *   0  — GREEN (×14)
 *   нечётные (1,3,5,7,9,11,13) — RED (×2) — итого 7 слотов
 *   чётные ≠ 0 (2,4,6,8,10,12,14) — BLACK (×2) — итого 7 слотов
 *
 * Распределение вероятностей идентично прежнему (1/15 GREEN, 7/15 RED, 7/15 BLACK),
 * меняется только пространственное расположение секторов на колесе.
 */
export const ROULETTE_TOTAL_SLOTS = 15;

export const PAYOUT_MULTIPLIER: Record<RouletteColor, number> = {
  GREEN: 14,
  RED: 2,
  BLACK: 2,
};

export function slotToColor(slot: number): RouletteColor {
  if (slot === 0) return 'GREEN';
  if (slot < 0 || slot >= ROULETTE_TOTAL_SLOTS) {
    throw new Error(`Invalid slot ${slot}`);
  }
  return slot % 2 === 1 ? 'RED' : 'BLACK';
}

export function calculatePayout(amountMinor: bigint, color: RouletteColor): bigint {
  const mult = BigInt(PAYOUT_MULTIPLIER[color]);
  return amountMinor * mult;
}
