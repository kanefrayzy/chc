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
      // externalId = числовой ID от Betra (data.id): именно его Betra вернёт в webhook как mirror_transaction_id
      externalId: String(data.id),
      externalAddress,
      originalAmount: displayAmount,
      originalCurrency: displayCurrency,
      exchangeRate: req.exchangeRate,
    };
  }

  verifyAndParseWebhook(headers: Record<string, string>, rawBody: string): ParsedWebhook {
    let payload: {
      id?: number;
      mirror_transaction_id?: number;
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

    // Betra может прислать order_id (по документации) или mirror_transaction_id (фактически)
    const transactionId =
      payload.order_id ??
      (payload.mirror_transaction_id != null ? String(payload.mirror_transaction_id) : null);

    if (!transactionId) {
      throw new BadRequestException('Missing order_id or mirror_transaction_id in webhook payload');
    }

    // Проверка подписи (два метода: body signature и X-Signature header)
    if (this.secret) {
      const numericId = payload.id ?? payload.mirror_transaction_id;
      let verified = false;

      // Метод 1: стандартный — HMAC-SHA256(id + order_id + status + timestamp) в payload.signature
      if (payload.signature) {
        const signData =
          String(numericId ?? '') +
          String(payload.order_id ?? '') +
          String(payload.status ?? '') +
          String(payload.timestamp ?? '');
        const expected = createHmac('sha256', this.secret).update(signData).digest('hex');
        try {
          const expectedBuf = Buffer.from(expected, 'hex');
          const actualBuf = Buffer.from(payload.signature, 'hex');
          if (expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf)) {
            verified = true;
          } else {
            this.logger.debug(
              `Betra method1 mismatch id=${numericId} signData="${signData}" expected=${expected} got=${payload.signature}`,
            );
          }
        } catch {
          // ignore parse errors, try next method
        }
      }

      // Метод 2: X-Signature заголовок — HMAC-SHA256(rawBody)
      if (!verified) {
        const xSig = headers['x-signature'] ?? headers['X-Signature'] ?? '';
        if (xSig) {
          const expected2 = createHmac('sha256', this.secret).update(rawBody).digest('hex');
          try {
            const expectedBuf2 = Buffer.from(expected2, 'hex');
            const actualBuf2 = Buffer.from(xSig, 'hex');
            if (expectedBuf2.length === actualBuf2.length && timingSafeEqual(expectedBuf2, actualBuf2)) {
              verified = true;
            } else {
              this.logger.debug(`Betra method2 mismatch expected=${expected2} got=${xSig}`);
            }
          } catch {
            // ignore
          }
        }
      }

      if (!verified) {
        this.logger.warn(
          `Betra webhook signature verification failed for id=${numericId}. ` +
            `rawBody=${rawBody} xSig=${headers['x-signature'] ?? ''}`,
        );
        throw new BadRequestException('Invalid webhook signature');
      }
    }

    return {
      externalId: transactionId,
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



