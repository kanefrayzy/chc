import { createHash, createHmac, randomBytes } from 'node:crypto';

/**
 * Provably fair RNG для «Классического» джекпота.
 *
 *  - serverSeed: 32 байта секрета, фиксируется при создании раунда и публикуется после.
 *  - publicSeed: 16 байт публичного nonce, генерируется при переходе в ROLLING.
 *  - winningTicket = (HMAC_SHA256(serverSeed, publicSeed) modulo bankMinor),
 *    интерпретация: первые 8 байт HMAC берём как BigInt, затем mod общего размера билетов
 *    (= bankMinor в qəpik). Победитель — игрок, чей диапазон [ticketsFrom, ticketsTo]
 *    содержит этот номер.
 */

export function generateClassicServerSeed(): string {
  return randomBytes(32).toString('hex');
}

export function hashClassicServerSeed(seed: string): string {
  return createHash('sha256').update(seed, 'utf8').digest('hex');
}

export function generateClassicPublicSeed(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Выбирает выигрышный билет [0, totalTickets - 1] из пары seed-ов.
 * totalTickets — общий размер банка в qəpik (BigInt).
 */
export function pickClassicWinningTicket(
  serverSeed: string,
  publicSeed: string,
  totalTickets: bigint,
): bigint {
  if (totalTickets <= 0n) {
    throw new Error('totalTickets must be > 0');
  }
  const hmac = createHmac('sha256', serverSeed).update(publicSeed, 'utf8').digest();
  // 64-битное число из первых 8 байт HMAC, затем mod от общего размера банка.
  const high = BigInt(hmac.readUInt32BE(0));
  const low = BigInt(hmac.readUInt32BE(4));
  const value = (high << 32n) | low;
  return value % totalTickets;
}
