import { createHash, createHmac, randomBytes } from 'node:crypto';

/**
 * Provably fair RNG для рулетки.
 * - serverSeed — секрет, фиксируется до раунда и публикуется после.
 * - publicSeed — публичный nonce (например, hash блока БК или просто random ID).
 * - results = HMAC_SHA256(serverSeed, publicSeed) → берём первые 4 байта как uint32.
 */

export function generateServerSeed(): string {
  return randomBytes(32).toString('hex');
}

export function hashServerSeed(seed: string): string {
  return createHash('sha256').update(seed, 'utf8').digest('hex');
}

export function generatePublicSeed(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Возвращает выпавший слот рулетки (0..total-1) из пары seed-ов.
 */
export function pickSlot(serverSeed: string, publicSeed: string, total: number): number {
  if (total <= 0) throw new Error('total must be > 0');
  const hmac = createHmac('sha256', serverSeed).update(publicSeed, 'utf8').digest();
  // 32-битное число → нормализуем по total. Смещение пренебрежимо мало для total=15.
  const value = hmac.readUInt32BE(0);
  return value % total;
}
