import type { PaymentProvider as PaymentProviderEnum } from '@prisma/client';

export interface CreateDepositRequest {
  depositId: string;
  userId: string;
  amountMinor: bigint;
  /** ISO-locale для лендинга провайдера */
  locale?: 'ru' | 'az';
  /**
   * Провайдер-специфичный конфиг из админ-настроек метода.
   * BETATRANSFER: `{ paymentSystem? }`.
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
  /**
   * Срок жизни счёта у провайдера (ISO-8601). Если задан — используется
   * вместо стандартного таймера (Betatransfer V2 даёт своё expired_at).
   */
  expiresAt?: string;
}

export interface ParsedWebhook {
  /** Идентификатор депозита у провайдера */
  externalId: string;
  /**
   * Статус, к которому переводим Deposit.
   * PENDING — промежуточный вебхук (например, Betatransfer при fullCallback=1):
   * подпись проверена, но депозит не трогаем.
   */
  status: 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'PENDING';
  /** Полезная нагрузка для записи в Deposit.rawWebhookPayload */
  rawPayload: unknown;
  /**
   * Фактически полученная сумма (для WestWallet IPN — сколько USDT пришло).
   * Если задано, DepositsService пересчитает amountMinor в AZN по курсу.
   */
  receivedAmount?: string;
  receivedCurrency?: string;
}

export interface PaymentProvider {
  readonly id: PaymentProviderEnum;
  createDeposit(req: CreateDepositRequest): Promise<CreateDepositResult>;
  /**
   * Проверяет подпись webhook'а и возвращает нормализованный результат.
   * Может быть асинхронным (Betatransfer V2 верифицирует статус запросом к API).
   */
  verifyAndParseWebhook(
    headers: Record<string, string>,
    rawBody: string,
  ): ParsedWebhook | Promise<ParsedWebhook>;
}
