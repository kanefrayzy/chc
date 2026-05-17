import type { PaymentProvider as PaymentProviderEnum } from '@prisma/client';

export interface CreateDepositRequest {
  depositId: string;
  userId: string;
  amountMinor: bigint;
  /** ISO-locale для лендинга провайдера */
  locale?: 'ru' | 'az';
  /**
   * Провайдер-специфичный конфиг из админ-настроек метода.
   * BETRA_H2H: `{ aggregators?, betraCurrency? }`.
   * WESTWALLET: `{ ticker?, dest_tag_required? }`.
   */
  config?: Record<string, unknown>;
  /** Валюта пользовательского метода (для логирования / провайдера) */
  currency?: string;
  /**
   * Сконвертированная сумма (в валюте платёжного метода).
   * Вычисляется в DepositsService перед вызовом провайдера.
   * Например: AZN 100.00 → RUB 5400, originalAmount='5400.00', originalCurrency='RUB'.
   */
  convertedAmount?: string;
  convertedCurrency?: string;
  /** Курс AZN→валюта на момент создания (для логирования). */
  exchangeRate?: string;
}

export interface CreateDepositResult {
  /** Внешний идентификатор у провайдера (для сверки webhook) */
  externalId: string;
  /** URL для редиректа пользователя (банковский ввод реквизитов и т.п.) */
  paymentUrl?: string;
  /** Адрес кошелька (для криптовалютных провайдеров) */
  externalAddress?: string;
  /** Оригинальная сумма (для крипты — конвертация AZN→USDT) */
  originalAmount?: string;
  originalCurrency?: string;
  exchangeRate?: string;
  /**
   * Если true — для этого депозита не нужен таймер истечения.
   * Используется WestWallet: статичный адрес кошелька не истекает.
   */
  noExpiry?: boolean;
}

export interface ParsedWebhook {
  /** Идентификатор депозита у провайдера */
  externalId: string;
  /** Финальный статус, к которому переводим Deposit */
  status: 'COMPLETED' | 'FAILED' | 'EXPIRED';
  /** Полезная нагрузка для записи в Deposit.rawWebhookPayload */
  rawPayload: unknown;
}

export interface PaymentProvider {
  readonly id: PaymentProviderEnum;
  createDeposit(req: CreateDepositRequest): Promise<CreateDepositResult>;
  /** Проверяет подпись webhook'а и возвращает нормализованный результат. */
  verifyAndParseWebhook(headers: Record<string, string>, rawBody: string): ParsedWebhook;
}
