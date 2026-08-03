/**
 * Моментальная лотерея «три в ряд».
 *
 * Карта — сетка 3×3 из символов. Каждый символ соответствует призовому уровню;
 * если три одинаковых символа открылись — игрок получает приз этого уровня.
 *
 * Призы заданы множителями к ставке, а не абсолютными суммами: так RTP не
 * меняется, если поменять цену билета в настройках. Шансы заданы весами из
 * пула `TICKET_POOL` — это позволяет считать RTP точно, целыми числами.
 *
 * Таблица построена по образцу Scratch! Gold: тот же максимум (×100 000) и тот
 * же порядок RTP, но номиналы округлены до сумм, которые ровно ложатся в qəpik.
 */

/** Размер пула билетов: веса ниже — это количество билетов каждого уровня. */
export const TICKET_POOL = 10_000_000;

export interface LotteryPrizeLevel {
  /** Индекс символа на карте. */
  symbol: number;
  /** Множитель к ставке в bps (10 000 = ×1). */
  multiplierBps: number;
  /** Сколько билетов из пула выигрывают этот уровень. */
  weight: number;
}

/** От самого крупного к самому мелкому — в этом же порядке рисуем таблицу в UI. */
export const LOTTERY_PRIZES: readonly LotteryPrizeLevel[] = [
  { symbol: 0, multiplierBps: 1_000_000_000, weight: 1 },        // ×100 000
  { symbol: 1, multiplierBps: 20_000_000, weight: 100 },         // ×2 000
  { symbol: 2, multiplierBps: 10_000_000, weight: 400 },         // ×1 000
  { symbol: 3, multiplierBps: 2_000_000, weight: 4_000 },        // ×200
  { symbol: 4, multiplierBps: 500_000, weight: 20_000 },         // ×50
  { symbol: 5, multiplierBps: 200_000, weight: 55_000 },         // ×20
  { symbol: 6, multiplierBps: 100_000, weight: 150_000 },        // ×10
  { symbol: 7, multiplierBps: 50_000, weight: 300_000 },         // ×5
  { symbol: 8, multiplierBps: 20_000, weight: 700_000 },         // ×2
  { symbol: 9, multiplierBps: 10_000, weight: 1_600_000 },       // ×1 (возврат ставки)
] as const;

/** Всего символов на карте. */
export const LOTTERY_CELLS = 9;

/** Сколько одинаковых символов даёт выигрыш. */
export const LOTTERY_MATCH = 3;

/** Ставка по умолчанию — 0.5 AZN. Переопределяется настройкой lottery.bet_minor. */
export const LOTTERY_DEFAULT_BET_MINOR = 50n;

export const LOTTERY_WINNING_WEIGHT = LOTTERY_PRIZES.reduce((sum, p) => sum + p.weight, 0);

/** Суммарный вес проигрышных билетов. */
export const LOTTERY_LOSING_WEIGHT = TICKET_POOL - LOTTERY_WINNING_WEIGHT;

/** Приз уровня при данной ставке — округление вниз, дом никогда не переплачивает. */
export function prizeForLevel(betMinor: bigint, level: LotteryPrizeLevel): bigint {
  return (betMinor * BigInt(level.multiplierBps)) / 10_000n;
}

/**
 * Теоретический RTP таблицы в bps. Считается по целым числам, поэтому
 * значение точное и его можно проверить тестом.
 */
export function theoreticalRtpBps(): number {
  const payout = LOTTERY_PRIZES.reduce(
    (sum, p) => sum + BigInt(p.weight) * BigInt(p.multiplierBps),
    0n,
  );
  // payout / (pool * 10000) в bps
  return Number((payout * 10_000n) / (BigInt(TICKET_POOL) * 10_000n));
}
