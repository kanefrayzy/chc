/**
 * Mines — единая игра 5×5 (TOTAL_TILES = 25).
 *
 * Множитель payout (как у провабли-фейр сlot-минеров типа Stake/Roobet):
 *   multiplier(k) = (1 - houseEdge) · Π_{i=0..k-1} (25 - i) / (25 - m - i)
 *      где m — число мин, k — число успешно открытых клеток.
 *   houseEdge задаётся через settings (basis points, по умолчанию 100 bps = 1%).
 */

export const MINES_TOTAL_TILES = 25;
export const MINES_GRID_SIZE = 5;
export const MINES_MIN_MINES = 1;
export const MINES_MAX_MINES = 24;
export const MINES_DEFAULT_HOUSE_EDGE_BPS = 100; // 1%
export const MINES_MULTIPLIER_PRECISION = 10_000; // bps × 100

/**
 * Возвращает текущий множитель × MINES_MULTIPLIER_PRECISION (целое).
 * picks = 0 → ровно MINES_MULTIPLIER_PRECISION (множитель 1.0000),
 * вне зависимости от houseEdge — нельзя списывать комиссию до первого хода.
 */
export function multiplierBps(
  mineCount: number,
  picks: number,
  houseEdgeBps: number = MINES_DEFAULT_HOUSE_EDGE_BPS,
): number {
  if (!Number.isInteger(mineCount) || mineCount < MINES_MIN_MINES || mineCount > MINES_MAX_MINES) {
    throw new Error('INVALID_MINE_COUNT');
  }
  if (!Number.isInteger(picks) || picks < 0) {
    throw new Error('INVALID_PICKS');
  }
  const safeTiles = MINES_TOTAL_TILES - mineCount;
  if (picks > safeTiles) {
    throw new Error('TOO_MANY_PICKS');
  }
  if (picks === 0) return MINES_MULTIPLIER_PRECISION;

  let m = (MINES_MULTIPLIER_PRECISION - houseEdgeBps) / MINES_MULTIPLIER_PRECISION;
  for (let i = 0; i < picks; i++) {
    m *= (MINES_TOTAL_TILES - i) / (safeTiles - i);
  }
  // округляем вниз — никогда не выплачиваем больше, чем выведено формулой
  return Math.floor(m * MINES_MULTIPLIER_PRECISION);
}

/** Возвращает payout в minor units. payout = bet · mult / PRECISION. */
export function calculateMinesPayout(betMinor: bigint, multBps: number): bigint {
  if (multBps <= 0) return 0n;
  return (betMinor * BigInt(multBps)) / BigInt(MINES_MULTIPLIER_PRECISION);
}
