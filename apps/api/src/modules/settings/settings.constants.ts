/**
 * Реестр настроек приложения. Все доступные ключи описаны здесь:
 *  - `defaultValue` используется когда строка отсутствует в БД;
 *  - `isPublic` определяет, попадает ли значение в /settings/public (для веба);
 *  - `type` валидирует ввод в админке.
 */

export type SettingType = 'boolean' | 'string' | 'number' | 'json';

export interface SettingDefinition {
  key: string;
  type: SettingType;
  defaultValue: unknown;
  isPublic: boolean;
  description: string;
}

export const SETTING_DEFINITIONS: readonly SettingDefinition[] = [
  // ─── Геймплей: фиче-флаги ────────────────────────────────────────────
  {
    key: 'gameplay.roulette_enabled',
    type: 'boolean',
    defaultValue: true,
    isPublic: true,
    description: 'Включает раздел рулетки',
  },
  {
    key: 'gameplay.referrals_enabled',
    type: 'boolean',
    defaultValue: true,
    isPublic: true,
    description: 'Партнёрская программа и начисления',
  },
  {
    key: 'gameplay.chat_enabled',
    type: 'boolean',
    defaultValue: true,
    isPublic: true,
    description: 'Чат поддержки и тикеты',
  },
  {
    key: 'gameplay.ranks_enabled',
    type: 'boolean',
    defaultValue: true,
    isPublic: true,
    description: 'VIP-ранги по wagered',
  },
  {
    key: 'gameplay.code_purchase_enabled',
    type: 'boolean',
    defaultValue: true,
    isPublic: true,
    description: 'Покупка промокодов через чат',
  },
  {
    key: 'gameplay.jackpot_enabled',
    type: 'boolean',
    defaultValue: false,
    isPublic: true,
    description: 'Модуль джекпота (пока MVP-заглушка)',
  },
  {
    key: 'gameplay.case_opening_enabled',
    type: 'boolean',
    defaultValue: false,
    isPublic: true,
    description: 'Открытие кейсов (пока MVP-заглушка)',
  },
  {
    key: 'gameplay.mines_enabled',
    type: 'boolean',
    defaultValue: true,
    isPublic: true,
    description: 'Включает мини-игру Mines',
  },
  // ─── Лимиты по деньгам ────────────────────────────────────────────────
  {
    key: 'deposit.min_amount_minor',
    type: 'string',
    defaultValue: '500',
    isPublic: true,
    description: 'Минимальный депозит в qəpik (например, 500 = 5.00 AZN)',
  },
  {
    key: 'deposit.max_amount_minor',
    type: 'string',
    defaultValue: '100000000',
    isPublic: true,
    description: 'Максимальный депозит в qəpik',
  },
  {
    key: 'withdrawal.min_amount_minor',
    type: 'string',
    defaultValue: '1000',
    isPublic: true,
    description: 'Минимальный вывод в qəpik (например, 1000 = 10.00 AZN)',
  },
  {
    key: 'withdrawal.manual_threshold_minor',
    type: 'string',
    defaultValue: '200000',
    isPublic: false,
    description: 'Сумма (qəpik), выше которой автовыводы переходят в ручной режим',
  },
  // ─── Реферальная программа ────────────────────────────────────────────
  {
    key: 'referral.from_loss_bps',
    type: 'number',
    defaultValue: 1000,
    isPublic: false,
    description: 'Базисные пункты от лосса (1000 bps = 10%)',
  },
  {
    key: 'referral.from_win_bps',
    type: 'number',
    defaultValue: 300,
    isPublic: false,
    description: 'Базисные пункты от выигрыша (300 bps = 3%)',
  },
  // ─── Рулетка ──────────────────────────────────────────────────────────
  {
    key: 'roulette.min_bet_minor',
    type: 'string',
    defaultValue: '100',
    isPublic: true,
    description: 'Минимальная ставка в рулетке (qəpik). 100 = 1.00 AZN',
  },
  {
    key: 'roulette.max_bet_minor',
    type: 'string',
    defaultValue: '100000',
    isPublic: true,
    description: 'Максимальная ставка в рулетке (qəpik). 100000 = 1000.00 AZN',
  },
  {
    key: 'roulette.forced_color',
    type: 'string',
    defaultValue: '',
    isPublic: false,
    description: 'Принудительный цвет следующего раунда рулетки (RED/GREEN/BLACK или пусто = авто).',
  },
  {
    key: 'roulette.daily_target_minor',
    type: 'string',
    defaultValue: '0',
    isPublic: false,
    description: '(Устарело) Суточный план GGR рулетки в qəpik.',
  },
  {
    key: 'roulette.house_edge_pct',
    type: 'number',
    defaultValue: 5,
    isPublic: false,
    description: 'Целевой доход казино от рулетки в % от оборота (0–100). Используется для антиминуса.',
  },
  {
    key: 'roulette.icon_url.green',
    type: 'string',
    defaultValue: '',
    isPublic: true,
    description: 'Иконка для зелёных секторов рулетки (URL PNG/WEBP). Если пусто — отображается корона.',
  },
  {
    key: 'roulette.icon_url.red',
    type: 'string',
    defaultValue: '',
    isPublic: true,
    description: 'Иконка для красных секторов рулетки (URL PNG/WEBP). Если пусто — без иконки.',
  },
  {
    key: 'roulette.icon_url.black',
    type: 'string',
    defaultValue: '',
    isPublic: true,
    description: 'Иконка для чёрных секторов рулетки (URL PNG/WEBP). Если пусто — без иконки.',
  },
  // ─── Mines ────────────────────────────────────────────────────────────
  {
    key: 'mines.min_bet_minor',
    type: 'string',
    defaultValue: '100',
    isPublic: true,
    description: 'Минимальная ставка в Mines (qəpik). 100 = 1.00 AZN',
  },
  {
    key: 'mines.max_bet_minor',
    type: 'string',
    defaultValue: '100000',
    isPublic: true,
    description: 'Максимальная ставка в Mines (qəpik). 100000 = 1000.00 AZN',
  },
  {
    key: 'mines.house_edge_bps',
    type: 'number',
    defaultValue: 100,
    isPublic: false,
    description: 'House edge в Mines в bps (100 bps = 1%). 0..9999.',
  },
  {
    key: 'mines.icon_url.gem',
    type: 'string',
    defaultValue: '',
    isPublic: true,
    description: 'Иконка кристалла в Mines (URL PNG/WEBP). Если пусто — используется встроенный SVG.',
  },
  {
    key: 'mines.icon_url.bomb',
    type: 'string',
    defaultValue: '',
    isPublic: true,
    description: 'Иконка бомбы в Mines (URL PNG/WEBP). Если пусто — используется встроенный SVG.',
  },
  // ─── Classic (jackpot) ────────────────────────────────────────────────
  {
    key: 'classic.min_bet_minor',
    type: 'string',
    defaultValue: '100',
    isPublic: true,
    description: 'Минимальная ставка в «Классическом» (qəpik). 100 = 1.00 AZN',
  },
  {
    key: 'classic.max_bet_minor',
    type: 'string',
    defaultValue: '10000000',
    isPublic: true,
    description: 'Максимальная ставка в «Классическом» (qəpik). 10000000 = 100 000 AZN',
  },
  {
    key: 'classic.commission_bps',
    type: 'number',
    defaultValue: 700,
    isPublic: false,
    description: 'Комиссия казино с банка «Классического» в bps (700 bps = 7%). 0..9999.',
  },
  {
    key: 'classic.round_duration_sec',
    type: 'number',
    defaultValue: 30,
    isPublic: true,
    description: 'Длительность приёма ставок после набора минимального числа игроков (сек).',
  },
  {
    key: 'classic.rolling_duration_sec',
    type: 'number',
    defaultValue: 8,
    isPublic: true,
    description: 'Длительность анимации розыгрыша в «Классическом» (сек).',
  },
  {
    key: 'classic.min_players_to_start',
    type: 'number',
    defaultValue: 2,
    isPublic: true,
    description: 'Минимум уникальных игроков для запуска обратного отсчёта раунда.',
  },
  {
    key: 'classic.forced_winner_user_id',
    type: 'string',
    defaultValue: '',
    isPublic: false,
    description: 'Принудительно сделать победителем следующего раунда указанного пользователя (по id). После использования сбрасывается.',
  },
  // ─── Геймплей: внешний URL казино ─────────────────────────────────────
  {
    key: 'gameplay.external_casino_url',
    type: 'string',
    defaultValue: 'https://star7sky.store/',
    isPublic: true,
    description: 'URL внешнего казино для iframe (страница /play). Пример: https://star7sky.store/',
  },
  // ─── Бонус при пополнении ────────────────────────────────────────────
  {
    key: 'deposit.bonus_bps',
    type: 'number',
    defaultValue: 0,
    isPublic: true,
    description: 'Бонус при депозите в базисных пунктах (1000 bps = 10%). 0 = без бонуса.',
  },
  // ─── Бренд / внешний вид ─────────────────────────────────────────────
  {
    key: 'brand.site_name',
    type: 'string',
    defaultValue: 'CHCGREEN',
    isPublic: true,
    description: 'Название сайта (отображается в шапке, заголовках страниц)',
  },
  {
    key: 'brand.logo_url',
    type: 'string',
    defaultValue: '',
    isPublic: true,
    description: 'URL логотипа (PNG/SVG). Если пусто — используется текстовый логотип.',
  },
  {
    key: 'brand.support_email',
    type: 'string',
    defaultValue: '',
    isPublic: true,
    description: 'Email службы поддержки (отображается на сайте)',
  },
  {
    key: 'brand.tagline',
    type: 'string',
    defaultValue: '',
    isPublic: true,
    description: 'Краткое описание сайта (используется в meta description и Open Graph).',
  },
  {
    key: 'brand.hero_image_url',
    type: 'string',
    defaultValue: '',
    isPublic: true,
    description: 'URL изображения hero-блока на главной (можно загрузить файлом).',
  },
  {
    key: 'landing.game_image_url.roulette',
    type: 'string',
    defaultValue: '',
    isPublic: true,
    description: 'Картинка плитки игры «Рулетка» на главной (можно загрузить файлом).',
  },
  {
    key: 'landing.game_image_url.mines',
    type: 'string',
    defaultValue: '',
    isPublic: true,
    description: 'Картинка плитки игры «Mines» на главной (можно загрузить файлом).',
  },
  {
    key: 'landing.game_image_url.classic',
    type: 'string',
    defaultValue: '',
    isPublic: true,
    description: 'Картинка плитки игры «Классика» на главной.',
  },
  {
    key: 'landing.game_image_url.cases',
    type: 'string',
    defaultValue: '',
    isPublic: true,
    description: 'Картинка плитки игры «Кейсы» на главной.',
  },
  // ─── Переводы (переопределение встроенных) ────────────────────────────
  {
    key: 'translations.ru',
    type: 'json',
    defaultValue: null,
    isPublic: false,
    description: 'Пользовательские переводы (ru). Если задано — перекрывает встроенный файл.',
  },
  {
    key: 'translations.az',
    type: 'json',
    defaultValue: null,
    isPublic: false,
    description: 'Пользовательские переводы (az). Если задано — перекрывает встроенный файл.',
  },
  // ─── Курсы валют ─────────────────────────────────────────────────────
  {
    key: 'exchange_rate.usd',
    type: 'number',
    defaultValue: 0.588,
    isPublic: true,
    description: '1 AZN = X USD. Обновляется вручную или через кнопку «Обновить курсы».',
  },
  {
    key: 'exchange_rate.rub',
    type: 'number',
    defaultValue: 54.0,
    isPublic: true,
    description: '1 AZN = X RUB.',
  },
  {
    key: 'exchange_rate.try',
    type: 'number',
    defaultValue: 20.0,
    isPublic: true,
    description: '1 AZN = X TRY.',
  },
] as const;

export const SETTING_DEFINITION_MAP: Readonly<Record<string, SettingDefinition>> = Object.freeze(
  SETTING_DEFINITIONS.reduce<Record<string, SettingDefinition>>((acc, def) => {
    acc[def.key] = def;
    return acc;
  }, {}),
);
