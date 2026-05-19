import { describe, it, expect } from 'vitest';
import {
  MINES_MAX_MINES,
  MINES_MULTIPLIER_PRECISION,
  MINES_TOTAL_TILES,
  calculateMinesPayout,
  multiplierBps,
} from './mines.constants';
import {
  generateMinesClientSeed,
  generateMinesLayout,
  generateMinesServerSeed,
  hashMinesServerSeed,
} from './mines.rng';

describe('mines.constants', () => {
  describe('multiplierBps', () => {
    it('returns precision (×1.0000) for picks=0 regardless of edge', () => {
      expect(multiplierBps(3, 0, 100)).toBe(MINES_MULTIPLIER_PRECISION);
      expect(multiplierBps(24, 0, 500)).toBe(MINES_MULTIPLIER_PRECISION);
    });

    it('increases monotonically with picks', () => {
      let prev = -1;
      for (let picks = 0; picks <= MINES_TOTAL_TILES - 3; picks++) {
        const m = multiplierBps(3, picks, 100);
        expect(m).toBeGreaterThan(prev);
        prev = m;
      }
    });

    it('increases with mineCount at the same picks', () => {
      const lowMines = multiplierBps(1, 5, 100);
      const highMines = multiplierBps(10, 5, 100);
      expect(highMines).toBeGreaterThan(lowMines);
    });

    it('matches the closed-form formula (3 mines, 1 pick, edge 1%)', () => {
      // (1 - 0.01) · 25/22 = 1.125 → 11250
      expect(multiplierBps(3, 1, 100)).toBe(Math.floor(0.99 * (25 / 22) * 10_000));
    });

    it('throws for invalid args', () => {
      expect(() => multiplierBps(0, 1, 100)).toThrow();
      expect(() => multiplierBps(MINES_MAX_MINES + 1, 1, 100)).toThrow();
      expect(() => multiplierBps(3, -1, 100)).toThrow();
      expect(() => multiplierBps(3, MINES_TOTAL_TILES - 3 + 1, 100)).toThrow();
    });
  });

  describe('calculateMinesPayout', () => {
    it('floors at minor unit', () => {
      // 100 minor × 11250 / 10000 = 112.5 → 112
      expect(calculateMinesPayout(100n, 11250)).toBe(112n);
    });

    it('returns 0 for non-positive multiplier', () => {
      expect(calculateMinesPayout(100n, 0)).toBe(0n);
    });

    it('matches × multiplier for clean numbers', () => {
      expect(calculateMinesPayout(10_000n, 20_000)).toBe(20_000n);
    });
  });
});

describe('mines.rng', () => {
  it('hash is deterministic SHA-256', () => {
    const seed = generateMinesServerSeed();
    expect(hashMinesServerSeed(seed)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashMinesServerSeed(seed)).toBe(hashMinesServerSeed(seed));
  });

  it('generates exactly mineCount unique positions in [0,25)', () => {
    const serverSeed = generateMinesServerSeed();
    const clientSeed = generateMinesClientSeed();
    for (const m of [1, 3, 5, 10, 24]) {
      const layout = generateMinesLayout(serverSeed, clientSeed, 0, m);
      expect(layout).toHaveLength(m);
      expect(new Set(layout).size).toBe(m);
      for (const p of layout) {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThan(MINES_TOTAL_TILES);
      }
      // sorted ascending
      const sorted = [...layout].sort((a, b) => a - b);
      expect(layout).toEqual(sorted);
    }
  });

  it('is deterministic for the same (server, client, nonce, mineCount)', () => {
    const serverSeed = 'a'.repeat(64);
    const clientSeed = 'client-seed-1';
    const a = generateMinesLayout(serverSeed, clientSeed, 0, 5);
    const b = generateMinesLayout(serverSeed, clientSeed, 0, 5);
    expect(a).toEqual(b);
  });

  it('produces different layouts for different nonces (sanity)', () => {
    const serverSeed = 'b'.repeat(64);
    const clientSeed = 'client-seed-2';
    const a = generateMinesLayout(serverSeed, clientSeed, 0, 5);
    const b = generateMinesLayout(serverSeed, clientSeed, 1, 5);
    expect(a).not.toEqual(b);
  });

  it('rejects mineCount out of range', () => {
    expect(() => generateMinesLayout('x', 'y', 0, 0)).toThrow();
    expect(() => generateMinesLayout('x', 'y', 0, MINES_TOTAL_TILES)).toThrow();
  });

  it('roughly uniform distribution of mine positions over many runs', () => {
    // sanity-check: каждая клетка попадает в число мин примерно одинаково.
    const N = 5000;
    const counts = new Array<number>(MINES_TOTAL_TILES).fill(0);
    for (let i = 0; i < N; i++) {
      const layout = generateMinesLayout('seed', 'client', i, 5);
      for (const p of layout) counts[p]++;
    }
    // expected = N * 5 / 25 = N/5 = 1000
    const expected = (N * 5) / MINES_TOTAL_TILES;
    for (const c of counts) {
      // допускаем 25% отклонения (rough sanity)
      expect(c).toBeGreaterThan(expected * 0.75);
      expect(c).toBeLessThan(expected * 1.25);
    }
  });
});
