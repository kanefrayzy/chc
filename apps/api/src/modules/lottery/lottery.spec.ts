import { describe, it, expect } from 'vitest';
import {
  LOTTERY_CELLS,
  LOTTERY_MATCH,
  LOTTERY_PRIZES,
  LOTTERY_DEFAULT_BET_MINOR,
  TICKET_POOL,
  prizeForLevel,
  theoreticalRtpBps,
} from './lottery.constants';
import {
  drawLotteryTicket,
  generateLotteryServerSeed,
  hashLotteryServerSeed,
} from './lottery.rng';

describe('lottery prize table', () => {
  it('RTP равен 96% ровно', () => {
    expect(theoreticalRtpBps()).toBe(9600);
  });

  it('выигрышных билетов меньше половины пула', () => {
    const winning = LOTTERY_PRIZES.reduce((s, p) => s + p.weight, 0);
    expect(winning).toBeLessThan(TICKET_POOL / 2);
    expect(winning).toBeGreaterThan(0);
  });

  it('максимальный приз при ставке 0.5 AZN — 50 000 AZN', () => {
    const top = LOTTERY_PRIZES[0]!;
    expect(prizeForLevel(LOTTERY_DEFAULT_BET_MINOR, top)).toBe(5_000_000n);
  });

  it('все призы делятся на qəpik без остатка при ставке по умолчанию', () => {
    for (const p of LOTTERY_PRIZES) {
      const prize = prizeForLevel(LOTTERY_DEFAULT_BET_MINOR, p);
      expect(prize > 0n).toBe(true);
      // умножение на bps должно быть кратно 10000 — иначе приз «съедает» копейки
      expect((LOTTERY_DEFAULT_BET_MINOR * BigInt(p.multiplierBps)) % 10_000n).toBe(0n);
    }
  });

  it('символы уникальны и идут по порядку', () => {
    const symbols = LOTTERY_PRIZES.map((p) => p.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
    expect(symbols).toEqual([...symbols].sort((a, b) => a - b));
  });

  it('множители строго убывают', () => {
    for (let i = 1; i < LOTTERY_PRIZES.length; i += 1) {
      expect(LOTTERY_PRIZES[i]!.multiplierBps).toBeLessThan(LOTTERY_PRIZES[i - 1]!.multiplierBps);
    }
  });
});

describe('lottery card generation', () => {
  const seeds = Array.from({ length: 400 }, (_, i) => `server-seed-${i}`);

  it('на карте всегда ровно 9 символов', () => {
    for (const seed of seeds) {
      const { symbols } = drawLotteryTicket(seed, 'client', 0);
      expect(symbols).toHaveLength(LOTTERY_CELLS);
    }
  });

  it('выигрышный символ встречается ровно три раза, остальные — не больше двух', () => {
    for (const seed of seeds) {
      const { level, symbols } = drawLotteryTicket(seed, 'client', 0);
      const counts = new Map<number, number>();
      for (const s of symbols) counts.set(s, (counts.get(s) ?? 0) + 1);

      if (level) {
        expect(counts.get(level.symbol)).toBe(LOTTERY_MATCH);
      }
      for (const [symbol, count] of counts) {
        if (level && symbol === level.symbol) continue;
        expect(count).toBeLessThan(LOTTERY_MATCH);
      }
    }
  });

  it('проигрышная карта не содержит ни одной тройки', () => {
    let losers = 0;
    for (const seed of seeds) {
      const { level, symbols } = drawLotteryTicket(seed, 'client', 0);
      if (level) continue;
      losers += 1;
      const counts = new Map<number, number>();
      for (const s of symbols) counts.set(s, (counts.get(s) ?? 0) + 1);
      expect(Math.max(...counts.values())).toBeLessThan(LOTTERY_MATCH);
    }
    // Проигрышных билетов ~72%, так что на 400 картах они точно встретятся
    expect(losers).toBeGreaterThan(0);
  });

  it('результат детерминирован для одной тройки сидов', () => {
    const a = drawLotteryTicket('seed-a', 'client-1', 7);
    const b = drawLotteryTicket('seed-a', 'client-1', 7);
    expect(a.symbols).toEqual(b.symbols);
    expect(a.level?.symbol ?? null).toBe(b.level?.symbol ?? null);
  });

  it('разные nonce дают разные карты', () => {
    const a = drawLotteryTicket('seed-a', 'client-1', 1);
    const b = drawLotteryTicket('seed-a', 'client-1', 2);
    expect(a.symbols).not.toEqual(b.symbols);
  });

  it('хеш серверного сида воспроизводим', () => {
    const seed = generateLotteryServerSeed();
    expect(hashLotteryServerSeed(seed)).toBe(hashLotteryServerSeed(seed));
    expect(hashLotteryServerSeed(seed)).toHaveLength(64);
  });
});

describe('lottery empirical distribution', () => {
  /**
   * Точный RTP уже доказан аналитически (`theoreticalRtpBps`), а эмпирическая
   * отдача на любой доступной в тесте выборке шумит на единицы процентов:
   * один приз ×1000 при 60 тыс. билетов — это сразу +1.7% к отдаче.
   *
   * Поэтому здесь проверяем то, что действительно должно держаться на такой
   * выборке: частоты выпадения совпадают с весами из таблицы.
   */
  const ROUNDS = 200_000;

  const counts = new Map<number | null, number>();
  for (let i = 0; i < ROUNDS; i += 1) {
    const { level } = drawLotteryTicket('rtp-server-seed', 'rtp-client', i);
    const key = level ? level.symbol : null;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  it('доля проигрышных билетов совпадает с таблицей', () => {
    const expected = (TICKET_POOL - LOTTERY_PRIZES.reduce((s, p) => s + p.weight, 0)) / TICKET_POOL;
    const actual = (counts.get(null) ?? 0) / ROUNDS;
    expect(Math.abs(actual - expected)).toBeLessThan(0.01);
  });

  it('частые призы выпадают с заявленной вероятностью', () => {
    // Только уровни, которых на такой выборке ожидается больше сотни —
    // у редких призов статистики не наберётся.
    const frequent = LOTTERY_PRIZES.filter((p) => (p.weight / TICKET_POOL) * ROUNDS >= 100);
    expect(frequent.length).toBeGreaterThan(0);

    for (const prize of frequent) {
      const expected = (prize.weight / TICKET_POOL) * ROUNDS;
      const actual = counts.get(prize.symbol) ?? 0;
      // Допуск 20% — с запасом покрывает нормальный разброс на этой выборке
      expect(Math.abs(actual - expected)).toBeLessThan(expected * 0.2);
    }
  });

  it('дом остаётся в плюсе, если исключить сверхредкие призы', () => {
    // Отдача по призам до ×200 включительно — та часть, что реально
    // формирует ежедневный результат казино.
    const bet = LOTTERY_DEFAULT_BET_MINOR;
    let returned = 0n;
    for (const prize of LOTTERY_PRIZES) {
      if (prize.multiplierBps > 2_000_000) continue; // крупнее ×200 — хвост
      returned += BigInt(counts.get(prize.symbol) ?? 0) * prizeForLevel(bet, prize);
    }
    const staked = BigInt(ROUNDS) * bet;
    expect(returned).toBeLessThan(staked);
  });
});
