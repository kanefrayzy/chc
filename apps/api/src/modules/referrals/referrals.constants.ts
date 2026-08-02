/** Referral rates in basis points (1bp = 0.01%). */
export const REFERRAL_FROM_LOSS_BPS = 1000; // 10% от чистой маржи казино по игроку
export const REFERRAL_FROM_DEPOSIT_BPS = 500; // 5% от суммы пополнения приглашённого
/** @deprecated бонус с выигрыша отключён — оставлено для старых записей. */
export const REFERRAL_FROM_WIN_BPS = 300;

export function calcEarningBps(sourceMinor: bigint, rateBps: number): bigint {
  if (sourceMinor <= 0n) return 0n;
  return (sourceMinor * BigInt(rateBps)) / 10_000n;
}
