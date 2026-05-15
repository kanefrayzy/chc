import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import {
  type CreateDepositRequest,
  type CreateDepositResult,
  type ParsedWebhook,
  type PaymentProvider,
} from './payment-provider.interface';

/**
 * Шлюз BETRA H2H.
 * Документация: https://betra.game/betrah2h-docs.html
 * Базовый URL: https://betra1.com/api/h2h
 *
 * Авторизация: X-Api-Key заголовок.
 * Депозит: POST /create → получаем card (реквизиты), без редиректа.
 * Вебхук: подпись = HMAC-SHA256(id + order_id + status + timestamp, secret).
 */
@Injectable()
export class BetraH2HProvider implements PaymentProvider {
  readonly id = 'BETRA_H2H' as const;
  private readonly logger = new Logger(BetraH2HProvider.name);
  private readonly secret: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly callbackUrl: string;
  private readonly aggregators: string[];

  constructor() {
    this.secret = process.env.BETRA_H2H_WEBHOOK_SECRET || '';
    this.apiKey = process.env.BETRA_H2H_API_KEY || '';
    this.baseUrl = (process.env.BETRA_H2H_API_URL || 'https://betra1.com/api/h2h').replace(/\/$/, '');
    this.callbackUrl = process.env.BETRA_H2H_CALLBACK_URL || '';
    const aggEnv = process.env.BETRA_H2H_AGGREGATORS || '';
    this.aggregators = aggEnv ? aggEnv.split(',').map((s) => s.trim()).filter(Boolean) : [];
  }

  async createDeposit(req: CreateDepositRequest): Promise<CreateDepositResult> {
    const displayAmount = req.convertedAmount ?? (Number(req.amountMinor) / 100).toFixed(2);
    const displayCurrency = (req.convertedCurrency ?? req.currency ?? 'AZN').toUpperCase();

    const body: Record<string, unknown> = {
      order_id: req.depositId,
      amount: parseFloat(displayAmount),
      currency: displayCurrency,
      customer: { user_id: req.userId },
    };
    if (this.callbackUrl) body.callback_url = this.callbackUrl;

    // Приоритет агрегаторов: сначала из конфига метода, потом из env
    const cfg = (req.config ?? {}) as Record<string, unknown>;
    const agg = Array.isArray(cfg['aggregators']) ? (cfg['aggregators'] as string[]) : this.aggregators;
    if (agg.length > 0) body.aggregators = agg;

    const response = await fetch(`${this.baseUrl}/create`, {
      method: 'POST',
      headers: {
        'X-Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.error(`Betra createDeposit HTTP ${response.status}: ${text}`);
      throw new Error(`Betra API error ${response.status}: ${text}`);
    }

    const json = (await response.json()) as {
      success: boolean;
      data?: {
        id: number;
        status: string;
        card: string | null;
        card_holder: string | null;
        bank: string | null;
        qr_link: string | null;
        expired_at: string;
      };
      message?: string;
    };

    if (!json.success || !json.data) {
      this.logger.error(`Betra createDeposit failed: ${JSON.stringify(json)}`);
      throw new Error(`Betra API returned success=false: ${json.message ?? 'unknown'}`);
    }

    const data = json.data;
    // card — номер карты для банковского перевода; qr_link — для СБП (агрегатор riopay)
    const externalAddress = data.card ?? data.qr_link ?? undefined;

    this.logger.log(
      `Betra createDeposit order=${req.depositId} betra_id=${data.id} ` +
        `${displayAmount} ${displayCurrency} ` +
        `card=${data.card ? '****' + data.card.slice(-4) : 'qr'} bank=${data.bank ?? '—'}`,
    );

    return {
      // externalId = наш depositId: именно его Betra вернёт в webhook.order_id
      externalId: req.depositId,
      externalAddress,
      originalAmount: displayAmount,
      originalCurrency: displayCurrency,
      exchangeRate: req.exchangeRate,
    };
  }

  verifyAndParseWebhook(_headers: Record<string, string>, rawBody: string): ParsedWebhook {
    let payload: {
      id?: number;
      order_id?: string;
      status?: string;
      timestamp?: number;
      signature?: string;
    };
    try {
      payload = JSON.parse(rawBody) as typeof payload;
    } catch {
      throw new BadRequestException('Invalid JSON body');
    }

    if (!payload.order_id) throw new BadRequestException('Missing order_id in webhook payload');

    // Проверка подписи: HMAC-SHA256(id + order_id + status + timestamp, secret)
    if (this.secret) {
      if (!payload.signature) throw new BadRequestException('Missing signature in webhook payload');
      const signData =
        String(payload.id ?? '') +
        String(payload.order_id) +
        String(payload.status ?? '') +
        String(payload.timestamp ?? '');
      const expected = createHmac('sha256', this.secret).update(signData).digest('hex');
      const expectedBuf = Buffer.from(expected, 'hex');
      const actualBuf = Buffer.from(payload.signature, 'hex');
      if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
        throw new BadRequestException('Invalid webhook signature');
      }
    }

    return {
      // order_id — это наш depositId, хранится в Deposit.externalId
      externalId: payload.order_id,
      status: mapBetraStatus(payload.status),
      rawPayload: payload,
    };
  }
}

function mapBetraStatus(raw: string | undefined): ParsedWebhook['status'] {
  switch ((raw ?? '').toLowerCase()) {
    case 'paid':
      return 'COMPLETED';
    case 'expired':
      return 'EXPIRED';
    case 'cancelled':
    case 'error':
    default:
      return 'FAILED';
  }
}


/**
 * Шлюз BETRA H2H (отображается в UI как «Limpay»).
 *
 * Текущая реализация — stub-уровень MVP:
 *   - createDeposit генерирует фейковый externalId + paymentUrl;
 *   - verifyAndParseWebhook проверяет HMAC-SHA256 заголовок `x-signature`.
 *
 * Реальная интеграция будет подключена в следующей итерации.
 */
@Injectable()
export class BetraH2HProvider implements PaymentProvider {
  readonly id = 'BETRA_H2H' as const;
  private readonly logger = new Logger(BetraH2HProvider.name);
  private readonly secret: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor() {
    this.secret = process.env.BETRA_H2H_WEBHOOK_SECRET || 'dev-betra-secret';
    this.apiKey = process.env.BETRA_H2H_API_KEY || '';
    this.apiSecret = process.env.BETRA_H2H_API_SECRET || '';
  }

  async createDeposit(req: CreateDepositRequest): Promise<CreateDepositResult> {
    const externalId = `betra_${randomUUID()}`;

    // Если DepositsService передал уже сконвертированную сумму — используем её.
    const displayAmount = req.convertedAmount ?? (Number(req.amountMinor) / 100).toFixed(2);
    const displayCurrency = req.convertedCurrency ?? req.currency ?? 'AZN';

    // TODO: Реальный API-вызов Betra H2H.
    // Betra возвращает реквизиты (номер карты/счёта) для перевода.
    // Пример: const res = await this.callBetraApi({ amount: displayAmount, currency: displayCurrency, ... });
    // const externalAddress = res.card_number;
    //
    // Пока используем заглушку — номер карты из env или фейковый.
    const externalAddress = process.env.BETRA_H2H_CARD_NUMBER || '4111111111111111';

    this.logger.log(
      `BETRA createDeposit deposit=${req.depositId} ext=${externalId} ` +
        `${displayAmount} ${displayCurrency}` +
        (req.exchangeRate ? ` (rate 1 AZN = ${req.exchangeRate} ${displayCurrency})` : ''),
    );
    return {
      externalId,
      externalAddress,
      originalAmount: displayAmount,
      originalCurrency: displayCurrency,
      exchangeRate: req.exchangeRate,
    };
  }

  verifyAndParseWebhook(headers: Record<string, string>, rawBody: string): ParsedWebhook {
    const signature = headers['x-signature'] ?? headers['X-Signature'];
    if (!signature) throw new BadRequestException('Missing X-Signature header');

    const expected = createHmac('sha256', this.secret).update(rawBody).digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    const actualBuf = Buffer.from(signature, 'hex');
    if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    let payload: { externalId?: string; status?: string };
    try {
      payload = JSON.parse(rawBody) as typeof payload;
    } catch {
      throw new BadRequestException('Invalid JSON body');
    }

    if (!payload.externalId) throw new BadRequestException('Missing externalId in payload');
    const status = mapBetraStatus(payload.status);

    return { externalId: payload.externalId, status, rawPayload: payload };
  }
}

function mapBetraStatus(raw: string | undefined): ParsedWebhook['status'] {
  switch ((raw ?? '').toUpperCase()) {
    case 'PAID':
    case 'COMPLETED':
    case 'SUCCESS':
      return 'COMPLETED';
    case 'EXPIRED':
      return 'EXPIRED';
    default:
      return 'FAILED';
  }
}
