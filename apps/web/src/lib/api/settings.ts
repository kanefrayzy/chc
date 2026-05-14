import { apiFetch } from './client';

export interface PublicSettings {
  'gameplay.roulette_enabled': boolean;
  'gameplay.referrals_enabled': boolean;
  'gameplay.chat_enabled': boolean;
  'gameplay.ranks_enabled': boolean;
  'gameplay.code_purchase_enabled': boolean;
  'gameplay.jackpot_enabled': boolean;
  'gameplay.case_opening_enabled': boolean;
  'gameplay.external_casino_url': string;
  'deposit.min_amount_minor': string;
  'deposit.max_amount_minor': string;
  'deposit.bonus_bps': number;
  'withdrawal.min_amount_minor': string;
  'brand.site_name': string;
  'brand.logo_url': string;
  'brand.support_email': string;
  'brand.tagline': string;
  'brand.hero_image_url': string;
  'landing.game_image_url.roulette': string;
  'landing.game_image_url.classic': string;
  'landing.game_image_url.cases': string;
  'brand.social_telegram': string;
  'brand.social_instagram': string;
  'brand.social_discord': string;
}

const DEFAULTS: PublicSettings = {
  'gameplay.roulette_enabled': true,
  'gameplay.referrals_enabled': true,
  'gameplay.chat_enabled': true,
  'gameplay.ranks_enabled': true,
  'gameplay.code_purchase_enabled': true,
  'gameplay.jackpot_enabled': false,
  'gameplay.case_opening_enabled': false,
  'gameplay.external_casino_url': '',
  'deposit.min_amount_minor': '500',
  'deposit.max_amount_minor': '100000000',
  'deposit.bonus_bps': 0,
  'withdrawal.min_amount_minor': '1000',
  'brand.site_name': 'CHCGREEN',
  'brand.logo_url': '',
  'brand.support_email': '',
  'brand.tagline': '',
  'brand.hero_image_url': '',
  'landing.game_image_url.roulette': '',
  'landing.game_image_url.classic': '',
  'landing.game_image_url.cases': '',
  'brand.social_telegram': '',
  'brand.social_instagram': '',
  'brand.social_discord': '',
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
