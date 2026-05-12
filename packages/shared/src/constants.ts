export const SUPPORTED_LOCALES = ['ru', 'az'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ru';

export const ROULETTE_PAYOUTS = {
  BLACK: 2,
  RED: 2,
  GREEN: 14,
} as const;

export const REFERRAL_RATE_BPS = {
  FROM_LOSS: 1000, // 10%
  FROM_WIN: 300, // 3%
} as const;
