import { createHash, createHmac, randomBytes } from 'node:crypto';
import {
  LOTTERY_CELLS,
  LOTTERY_MATCH,
  LOTTERY_PRIZES,
  TICKET_POOL,
  type LotteryPrizeLevel,
} from './lottery.constants';

/**
 * Provably-fair RNG лотереи — та же схема, что в Mines.
 *
 * До покупки сервер публикует serverSeedHash = SHA256(serverSeed). После
 * вскрытия карты serverSeed раскрывается, и игрок может пересчитать результат:
 *
 *   stream = HMAC-SHA256(serverSeed, `${clientSeed}:${nonce}:${counter}`)
 *
 * Из потока сначала берётся номер билета в пуле (он определяет приз),
 * затем — раскладка символов по карте.
 */

export function generateLotteryServerSeed(): string {
  return randomBytes(32).toString('hex');
}

export function hashLotteryServerSeed(seed: string): string {
  return createHash('sha256').update(seed, 'utf8').digest('hex');
}

export function generateLotteryClientSeed(): string {
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
    this.buffer = Buffer.concat([
      this.buffer,
      createHmac('sha256', this.serverSeed).update(msg, 'utf8').digest(),
    ]);
  }

  readUint32(): number {
    while (this.buffer.length < 4) this.refill();
    const v = this.buffer.readUInt32BE(0);
    this.buffer = this.buffer.subarray(4);
    return v;
  }

  /** Беспредвзятый sample из [0, n) через rejection sampling. */
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

export interface LotteryDraw {
  /** Уровень приза или null, если билет не выиграл. */
  level: LotteryPrizeLevel | null;
  /** 9 символов карты в порядке ячеек. */
  symbols: number[];
}

/**
 * Разыгрывает билет: сперва номер в пуле (он и решает приз), затем раскладка.
 *
 * Раскладка строится так, чтобы на карте не оказалось «случайного» третьего
 * совпадения: выигрышный уровень получает ровно 3 символа, все остальные —
 * не больше двух.
 */
export function drawLotteryTicket(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): LotteryDraw {
  const stream = new HmacByteStream(serverSeed, clientSeed, nonce);

  // 1. Номер билета в пуле → приз
  const ticket = stream.randomBelow(TICKET_POOL);
  let cursor = 0;
  let level: LotteryPrizeLevel | null = null;
  for (const prize of LOTTERY_PRIZES) {
    if (ticket >= cursor && ticket < cursor + prize.weight) {
      level = prize;
      break;
    }
    cursor += prize.weight;
  }

  // 2. Раскладка символов
  const counts = new Map<number, number>();
  const cells: number[] = [];

  if (level) {
    for (let i = 0; i < LOTTERY_MATCH; i += 1) cells.push(level.symbol);
    counts.set(level.symbol, LOTTERY_MATCH);
  }

  while (cells.length < LOTTERY_CELLS) {
    // Кандидаты — символы, которых на карте меньше двух и которые не являются
    // выигрышным уровнем (его количество уже зафиксировано).
    const candidates = LOTTERY_PRIZES.map((p) => p.symbol).filter((s) => {
      if (level && s === level.symbol) return false;
      return (counts.get(s) ?? 0) < LOTTERY_MATCH - 1;
    });
    const picked = candidates[stream.randomBelow(candidates.length)]!;
    cells.push(picked);
    counts.set(picked, (counts.get(picked) ?? 0) + 1);
  }

  // 3. Перемешиваем позиции (Fisher-Yates), чтобы тройка не лежала подряд
  for (let i = cells.length - 1; i > 0; i -= 1) {
    const j = stream.randomBelow(i + 1);
    [cells[i], cells[j]] = [cells[j]!, cells[i]!];
  }

  return { level, symbols: cells };
}
