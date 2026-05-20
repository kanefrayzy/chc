/**
 * Константы и хелперы для игры «Классический» (jackpot).
 *
 * Бизнес-логика:
 *  - В каждом раунде игроки скидываются в общий банк.
 *  - Шанс на победу пропорционален вкладу: chance = bet / bank.
 *  - Когда в раунде собирается минимум `minPlayersToStart` уникальных игроков —
 *    запускается обратный отсчёт длительностью `roundDurationSec`.
 *  - По окончании отсчёта раунд переходит в ROLLING (анимация), затем — выплата победителю
 *    (банк за вычетом комиссии).
 */

export const CLASSIC_DEFAULT_MIN_BET = 100n; // 1.00 AZN
export const CLASSIC_DEFAULT_MAX_BET = 10_000_00n; // 10 000 AZN
export const CLASSIC_DEFAULT_COMMISSION_BPS = 700; // 7%
export const CLASSIC_DEFAULT_ROUND_DURATION_SEC = 30;
export const CLASSIC_DEFAULT_ROLLING_DURATION_MS = 8_000;
export const CLASSIC_DEFAULT_MIN_PLAYERS = 2;

/**
 * Вычисляет сумму выплаты победителю с учётом комиссии заведения.
 *  payout = bank * (10000 - commissionBps) / 10000
 */
export function calculateClassicPayout(bankMinor: bigint, commissionBps: number): bigint {
  if (bankMinor <= 0n) return 0n;
  const bps = Math.max(0, Math.min(10_000, commissionBps));
  const remainBps = BigInt(10_000 - bps);
  return (bankMinor * remainBps) / 10_000n;
}

/**
 * Сколько процентов комиссии (для отображения).
 */
export function commissionPct(bps: number): number {
  return Math.round((bps / 100) * 100) / 100;
}
