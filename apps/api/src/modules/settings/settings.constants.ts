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
] as const;

export const SETTING_DEFINITION_MAP: Readonly<Record<string, SettingDefinition>> = Object.freeze(
  SETTING_DEFINITIONS.reduce<Record<string, SettingDefinition>>((acc, def) => {
    acc[def.key] = def;
    return acc;
  }, {}),
);
