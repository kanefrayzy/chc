import { apiFetch } from './client';

export interface PublicSettings {
  'gameplay.roulette_enabled': boolean;
  'gameplay.mines_enabled': boolean;
  'gameplay.lottery_enabled': boolean;
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
  'roulette.min_bet_minor': string;
  'roulette.max_bet_minor': string;
  'roulette.icon_url.green': string;
  'roulette.icon_url.red': string;
  'roulette.icon_url.black': string;
  'mines.min_bet_minor': string;
  'mines.max_bet_minor': string;
  'mines.icon_url.gem': string;
  'mines.icon_url.bomb': string;
  'classic.min_bet_minor': string;
  'classic.max_bet_minor': string;
  'classic.round_duration_sec': number;
  'classic.rolling_duration_sec': number;
  'classic.min_players_to_start': number;
  'brand.site_name': string;
  'brand.logo_url': string;
  'brand.support_email': string;
  'brand.tagline': string;
  'brand.hero_image_url': string;
  'landing.game_image_url.roulette': string;
  'landing.game_image_url.mines': string;
  'landing.game_image_url.classic': string;
  'landing.game_image_url.cases': string;
  'landing.game_image_url.lottery': string;
  'landing.game_image_url.codes': string;
  'brand.social_telegram': string;
  'brand.social_telegram_label': string;
  'brand.social_instagram': string;
  'brand.social_discord': string;
}

const DEFAULTS: PublicSettings = {
  'gameplay.roulette_enabled': true,
  'gameplay.mines_enabled': true,
  'gameplay.lottery_enabled': true,
  'gameplay.referrals_enabled': true,
  'gameplay.chat_enabled': true,
  'gameplay.ranks_enabled': true,
  'gameplay.code_purchase_enabled': true,
  'gameplay.jackpot_enabled': false,
  'gameplay.case_opening_enabled': false,
  'gameplay.external_casino_url': 'https://star7sky.store/',
  'deposit.min_amount_minor': '500',
  'deposit.max_amount_minor': '100000000',
  'deposit.bonus_bps': 0,
  'withdrawal.min_amount_minor': '5000',
  'roulette.min_bet_minor': '100',
  'roulette.max_bet_minor': '100000',
  'roulette.icon_url.green': '',
  'roulette.icon_url.red': '',
  'roulette.icon_url.black': '',
  'mines.min_bet_minor': '100',
  'mines.max_bet_minor': '100000',
  'mines.icon_url.gem': '',
  'mines.icon_url.bomb': '',
  'classic.min_bet_minor': '100',
  'classic.max_bet_minor': '10000000',
  'classic.round_duration_sec': 30,
  'classic.rolling_duration_sec': 8,
  'classic.min_players_to_start': 2,
  'brand.site_name': 'CHCGREEN',
  'brand.logo_url': '',
  'brand.support_email': '',
  'brand.tagline': '',
  'brand.hero_image_url': '',
  'landing.game_image_url.roulette': '',
  'landing.game_image_url.mines': '',
  'landing.game_image_url.classic': '',
  'landing.game_image_url.cases': '',
  'landing.game_image_url.lottery': '',
  'landing.game_image_url.codes': '',
  'brand.social_telegram': '',
  'brand.social_telegram_label': '',
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
