import { apiFetch } from './client';

export interface PublicSettings {
  'gameplay.roulette_enabled': boolean;
  'gameplay.referrals_enabled': boolean;
  'gameplay.chat_enabled': boolean;
  'gameplay.ranks_enabled': boolean;
  'gameplay.code_purchase_enabled': boolean;
  'gameplay.jackpot_enabled': boolean;
  'gameplay.case_opening_enabled': boolean;
  'deposit.min_amount_minor': string;
  'deposit.max_amount_minor': string;
  'withdrawal.min_amount_minor': string;
}

const DEFAULTS: PublicSettings = {
  'gameplay.roulette_enabled': true,
  'gameplay.referrals_enabled': true,
  'gameplay.chat_enabled': true,
  'gameplay.ranks_enabled': true,
  'gameplay.code_purchase_enabled': true,
  'gameplay.jackpot_enabled': false,
  'gameplay.case_opening_enabled': false,
  'deposit.min_amount_minor': '500',
  'deposit.max_amount_minor': '100000000',
  'withdrawal.min_amount_minor': '1000',
};

/**
 * Получить публичные настройки. При сетевой ошибке — безопасные дефолты.
 */
export async function getPublicSettings(): Promise<PublicSettings> {
  try {
    const raw = await apiFetch<Record<string, unknown>>('/settings/public');
    return { ...DEFAULTS, ...(raw as Partial<PublicSettings>) };
  } catch {
    return DEFAULTS;
  }
}
