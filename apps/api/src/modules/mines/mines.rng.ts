import { createHash, createHmac, randomBytes } from 'node:crypto';
import { MINES_TOTAL_TILES } from './mines.constants';

/**
 * Provably-fair RNG для Mines.
 *
 * До начала игры сервер генерирует `serverSeed` (32 байта) и публикует
 * `serverSeedHash = SHA256(serverSeed)`. После окончания игры (cashout/bust)
 * `serverSeed` раскрывается клиенту, который может перепроверить:
 *
 *   stream = HMAC-SHA256(serverSeed, `${clientSeed}:${nonce}:${counter}`)
 *
 * Из потока байт алгоритмом Фишера-Йетса перемешиваются индексы 0..24,
 * первые `mineCount` штук — позиции мин. Используется rejection sampling
 * по 4 байта, чтобы не было модуло-смещения.
 */

export function generateMinesServerSeed(): string {
  return randomBytes(32).toString('hex');
}

export function hashMinesServerSeed(seed: string): string {
  return createHash('sha256').update(seed, 'utf8').digest('hex');
}

export function generateMinesClientSeed(): string {
  return randomBytes(16).toString('hex');
}

class HmacByteStream {
  private buffer: Buffer = Buffer.alloc(0);
  private counter = 0;

  constructor(
    private readonly serverSeed: string,
    private readonly clientSeed: string,
    private readonly nonce: number,
  ) {}

  private refill(): void {
    const msg = `${this.clientSeed}:${this.nonce}:${this.counter}`;
    this.counter += 1;
    const next = createHmac('sha256', this.serverSeed).update(msg, 'utf8').digest();
    this.buffer = Buffer.concat([this.buffer, next]);
  }

  /** Беззнаковое 32-битное число. */
  readUint32(): number {
    while (this.buffer.length < 4) this.refill();
    const v = this.buffer.readUInt32BE(0);
    this.buffer = this.buffer.subarray(4);
    return v;
  }

  /**
   * Беспредвзятый sample из [0, n). Используется rejection sampling:
   * берём uint32 и отбрасываем значения из «хвоста», который не делится на n
   * (для n ≤ 25 вероятность отбрасывания < 1e-8).
   */
  randomBelow(n: number): number {
    if (n <= 0) throw new Error('n must be > 0');
    const limit = Math.floor(0x1_0000_0000 / n) * n;
    let v: number;
    do {
      v = this.readUint32();
    } while (v >= limit);
    return v % n;
  }
}

/**
 * Возвращает отсортированный массив позиций мин (длина = mineCount).
 * Детерминированно для тройки (serverSeed, clientSeed, nonce).
 */
export function generateMinesLayout(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  mineCount: number,
): number[] {
  if (mineCount < 1 || mineCount >= MINES_TOTAL_TILES) {
    throw new Error('INVALID_MINE_COUNT');
  }
  const stream = new HmacByteStream(serverSeed, clientSeed, nonce);
  const positions = Array.from({ length: MINES_TOTAL_TILES }, (_, i) => i);
  // Fisher-Yates: достаточно перемешать первые mineCount элементов, но для
  // прозрачности и совместимости делаем полный проход.
  for (let i = positions.length - 1; i > 0; i--) {
    const j = stream.randomBelow(i + 1);
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  return positions.slice(0, mineCount).sort((a, b) => a - b);
}
