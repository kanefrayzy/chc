import { describe, it, expect } from 'vitest';
import {
  REFERRAL_FROM_LOSS_BPS,
  REFERRAL_FROM_WIN_BPS,
  calcEarningBps,
} from './referrals.constants';

describe('referrals.constants', () => {
  it('defaults: 10% loss / 3% win', () => {
    expect(REFERRAL_FROM_LOSS_BPS).toBe(1000);
    expect(REFERRAL_FROM_WIN_BPS).toBe(300);
  });

  describe('calcEarningBps', () => {
    it('returns 0 for non-positive source', () => {
      expect(calcEarningBps(0n, 1000)).toBe(0n);
      expect(calcEarningBps(-100n, 1000)).toBe(0n);
    });
    it('10% of 10 000 = 1000', () => {
      expect(calcEarningBps(10_000n, REFERRAL_FROM_LOSS_BPS)).toBe(1000n);
    });
    it('3% of 10 000 = 300', () => {
      expect(calcEarningBps(10_000n, REFERRAL_FROM_WIN_BPS)).toBe(300n);
    });
    it('truncates fractional minor units (BigInt division)', () => {
      // 10% от 999 = 99.9 → 99
      expect(calcEarningBps(999n, 1000)).toBe(99n);
    });
    it('handles huge amounts', () => {
      const huge = 1_000_000_000_000n; // 10 млрд qəpik
      expect(calcEarningBps(huge, REFERRAL_FROM_LOSS_BPS)).toBe(huge / 10n);
    });
  });
});
