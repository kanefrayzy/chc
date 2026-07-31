import { describe, it, expect } from 'vitest';
import {
  PAYOUT_MULTIPLIER,
  ROULETTE_TOTAL_SLOTS,
  calculatePayout,
  slotToColor,
} from './roulette.constants';
import {
  generatePublicSeed,
  generateServerSeed,
  hashServerSeed,
  pickSlot,
} from './roulette.rng';

describe('roulette.constants', () => {
  describe('slotToColor', () => {
    it('slot 0 → GREEN', () => {
      expect(slotToColor(0)).toBe('GREEN');
    });
    // Колесо чередует цвета: нечётные слоты — RED, чётные (кроме 0) — BLACK.
    it('нечётные слоты → RED', () => {
      for (let s = 1; s <= 13; s += 2) expect(slotToColor(s)).toBe('RED');
    });
    it('чётные слоты (кроме 0) → BLACK', () => {
      for (let s = 2; s <= 14; s += 2) expect(slotToColor(s)).toBe('BLACK');
    });
    // Экономика игры зависит именно от количества слотов каждого цвета:
    // 7 RED / 7 BLACK / 1 GREEN даёт одинаковый дом-эдж 6.67% на любой ставке.
    it('раскладка колеса: 7 RED, 7 BLACK, 1 GREEN', () => {
      const counts = { RED: 0, BLACK: 0, GREEN: 0 };
      for (let s = 0; s < 15; s++) counts[slotToColor(s)] += 1;
      expect(counts).toEqual({ RED: 7, BLACK: 7, GREEN: 1 });
    });
    it('out-of-range throws', () => {
      expect(() => slotToColor(-1)).toThrow();
      expect(() => slotToColor(15)).toThrow();
    });
  });

  describe('calculatePayout', () => {
    it('RED/BLACK = ×2', () => {
      expect(calculatePayout(100n, 'RED')).toBe(200n);
      expect(calculatePayout(100n, 'BLACK')).toBe(200n);
    });
    it('GREEN = ×14', () => {
      expect(calculatePayout(100n, 'GREEN')).toBe(1400n);
    });
    it('multipliers match constants', () => {
      expect(PAYOUT_MULTIPLIER.GREEN).toBe(14);
      expect(PAYOUT_MULTIPLIER.RED).toBe(2);
      expect(PAYOUT_MULTIPLIER.BLACK).toBe(2);
    });
    it('handles large BigInt without overflow', () => {
      const huge = 1_000_000_000_000n;
      expect(calculatePayout(huge, 'GREEN')).toBe(huge * 14n);
    });
  });
});

describe('roulette.rng', () => {
  it('pickSlot is deterministic for fixed seeds', () => {
    const a = pickSlot('seed-a', 'pub-1', ROULETTE_TOTAL_SLOTS);
    const b = pickSlot('seed-a', 'pub-1', ROULETTE_TOTAL_SLOTS);
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(ROULETTE_TOTAL_SLOTS);
  });
  it('pickSlot differs for different seeds', () => {
    const a = pickSlot('s1', 'p', ROULETTE_TOTAL_SLOTS);
    const b = pickSlot('s2', 'p', ROULETTE_TOTAL_SLOTS);
    // 1/15 шанс совпасть — для смок-теста допустимо проверить что хотя бы один из вариантов отличается
    const c = pickSlot('s3', 'p', ROULETTE_TOTAL_SLOTS);
    expect(new Set([a, b, c]).size).toBeGreaterThan(1);
  });
  it('pickSlot throws on total<=0', () => {
    expect(() => pickSlot('s', 'p', 0)).toThrow();
  });
  it('hashServerSeed is sha256-hex (64 chars)', () => {
    const seed = generateServerSeed();
    const hash = hashServerSeed(seed);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
  it('generateServerSeed/generatePublicSeed produce unique hex strings', () => {
    expect(generateServerSeed()).not.toBe(generateServerSeed());
    expect(generatePublicSeed()).not.toBe(generatePublicSeed());
  });
  it('distribution is roughly uniform over 15 000 samples', () => {
    const counts = new Array(ROULETTE_TOTAL_SLOTS).fill(0);
    for (let i = 0; i < 15_000; i++) {
      counts[pickSlot(generateServerSeed(), generatePublicSeed(), ROULETTE_TOTAL_SLOTS)] += 1;
    }
    // средняя 1000, допуск ±35% — статистический тест
    for (const c of counts) {
      expect(c).toBeGreaterThan(650);
      expect(c).toBeLessThan(1350);
    }
  });
});
