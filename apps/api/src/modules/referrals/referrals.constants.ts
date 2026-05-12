/** Referral rates in basis points (1bp = 0.01%). */
export const REFERRAL_FROM_LOSS_BPS = 1000; // 10%
export const REFERRAL_FROM_WIN_BPS = 300; // 3%

export function calcEarningBps(sourceMinor: bigint, rateBps: number): bigint {
  if (sourceMinor <= 0n) return 0n;
  return (sourceMinor * BigInt(rateBps)) / 10_000n;
}
