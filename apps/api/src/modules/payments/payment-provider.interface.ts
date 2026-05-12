import type { PaymentProvider as PaymentProviderEnum } from '@prisma/client';

export interface CreateDepositRequest {
  depositId: string;
  userId: string;
  amountMinor: bigint;
  /** ISO-locale для лендинга провайдера */
  locale?: 'ru' | 'az';
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
