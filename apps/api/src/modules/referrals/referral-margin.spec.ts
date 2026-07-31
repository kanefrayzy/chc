import { describe, expect, it } from 'vitest';
import { calcEarningBps } from './referrals.constants';

/**
 * Антиминус реферальной программы (ADR-0008).
 *
 * Бонус пригласившему платится только с накопленной положительной маржи казино
 * по конкретному игроку. Здесь проверяется сама модель переноса долга — та же
 * арифметика, что и в ReferralsService.settleGameMargin.
 */
function settle(
  carry: bigint,
  marginMinor: bigint,
  rateBps: number,
): { carry: bigint; earning: bigint } {
  const next = carry + marginMinor;
  if (next <= 0n) return { carry: next, earning: 0n };
  return { carry: 0n, earning: calcEarningBps(next, rateBps) };
}

/** Прогоняет серию игр и возвращает итог казино с учётом реферальных выплат. */
function houseResult(margins: bigint[], rateBps: number): bigint {
  let carry = 0n;
  let house = 0n;
  for (const m of margins) {
    const res = settle(carry, m, rateBps);
    carry = res.carry;
    house += m - res.earning;
  }
  return house;
}

const RATE = 1000; // 10%

describe('referral anti-minus model', () => {
  it('платит процент только с положительной маржи', () => {
    const res = settle(0n, 1000n, RATE);
    expect(res.earning).toBe(100n);
    expect(res.carry).toBe(0n);
  });

  it('выигрыш игрока уходит в долг и бонус не платится', () => {
    const res = settle(0n, -5000n, RATE);
    expect(res.earning).toBe(0n);
    expect(res.carry).toBe(-5000n);
  });

  it('долг должен быть отыгран до следующей выплаты', () => {
    let carry = -1000n;
    // Проигрыш 600 не перекрывает долг — выплаты нет
    let res = settle(carry, 600n, RATE);
    carry = res.carry;
    expect(res.earning).toBe(0n);
    expect(carry).toBe(-400n);

    // Ещё 900 — долг закрыт, платим 10% с остатка 500
    res = settle(carry, 900n, RATE);
    expect(res.earning).toBe(50n);
    expect(res.carry).toBe(0n);
  });

  it('mines 24 мины: удержание маржи сходится к 90% по мере игры', () => {
    // Цикл: 24 проигрыша по 1000 (+1000) и один выигрыш ×24.75 (−23_750).
    // Маржа казино за цикл = 250 (это и есть 1% дом-эджа со ставки 1000).
    const run = (cycles: number): { house: bigint; gross: bigint } => {
      const margins: bigint[] = [];
      for (let c = 0; c < cycles; c++) {
        for (let i = 0; i < 24; i++) margins.push(1000n);
        margins.push(-23_750n);
      }
      return { house: houseResult(margins, RATE), gross: 250n * BigInt(cycles) };
    };

    // Разовый стартовый перерасход (бонусы выплачены до первого крупного выигрыша)
    // отыгрывается: доля удержанной маржи растёт и стремится к 90%.
    const short = run(40);
    const long = run(1000);
    expect(short.house).toBeGreaterThan(0n);
    expect((long.house * 100n) / long.gross).toBeGreaterThan(
      (short.house * 100n) / short.gross,
    );
    expect((long.house * 100n) / long.gross).toBeGreaterThan(85n);
  });

  it('рулетка GREEN: на дистанции казино остаётся в плюсе', () => {
    // Цикл: 14 проигрышей по 1000 и один выигрыш ×14 (−13_000). Маржа за цикл = 1000.
    const margins: bigint[] = [];
    for (let c = 0; c < 40; c++) {
      for (let i = 0; i < 14; i++) margins.push(1000n);
      margins.push(-13_000n);
    }
    const gross = 1000n * 40n;
    const house = houseResult(margins, RATE);
    expect(house).toBeGreaterThan(0n);
    expect(house).toBeGreaterThan((gross * 8000n) / 10_000n);
  });

  it('стартовый перерасход ограничен и отыгрывается: долг не накапливается бесконечно', () => {
    // Один цикл mines может дать временный минус, но каждый следующий — только плюс.
    const cycle = (): bigint[] => {
      const m: bigint[] = [];
      for (let i = 0; i < 24; i++) m.push(1000n);
      m.push(-23_750n);
      return m;
    };
    const oneCycle = houseResult(cycle(), RATE);
    const manyCycles = houseResult([...cycle(), ...cycle(), ...cycle(), ...cycle()], RATE);
    // Первый цикл может быть в минусе, но каждый следующий улучшает результат
    expect(manyCycles).toBeGreaterThan(oneCycle);
  });

  it('сговор: игрок выигрывает и проигрывает по кругу — казино не платит из своего кармана', () => {
    const margins: bigint[] = [];
    for (let i = 0; i < 50; i++) margins.push(i % 2 === 0 ? -1000n : 1000n);
    // Итоговая маржа казино = 0, выплат быть не должно
    expect(houseResult(margins, RATE)).toBe(0n);
  });

  it('казино всегда оставляет себе не менее (100 − ставка)% своей маржи', () => {
    const margins = [5000n, -2000n, 3000n, -500n, 1200n];
    const gross = margins.reduce((a, b) => a + b, 0n); // 6700
    const house = houseResult(margins, RATE);
    expect(house).toBeGreaterThanOrEqual((gross * 9000n) / 10_000n);
    expect(house).toBeLessThanOrEqual(gross);
  });
});
