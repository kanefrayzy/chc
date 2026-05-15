import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import {
  type CreateDepositRequest,
  type CreateDepositResult,
  type ParsedWebhook,
  type PaymentProvider,
} from './payment-provider.interface';

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
  private readonly publicUrl: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor() {
    this.secret = process.env.BETRA_H2H_WEBHOOK_SECRET || 'dev-betra-secret';
    this.publicUrl = process.env.BETRA_H2H_REDIRECT_BASE || 'https://pay.example.com/betra';
    this.apiKey = process.env.BETRA_H2H_API_KEY || '';
    this.apiSecret = process.env.BETRA_H2H_API_SECRET || '';
  }

  async createDeposit(req: CreateDepositRequest): Promise<CreateDepositResult> {
    const externalId = `betra_${randomUUID()}`;

    // Если DepositsService передал уже сконвертированную сумму — используем её.
    const displayAmount = req.convertedAmount ?? (Number(req.amountMinor) / 100).toFixed(2);
    const displayCurrency = req.convertedCurrency ?? req.currency ?? 'AZN';
    const paymentUrl = `${this.publicUrl}/${externalId}?amount=${displayAmount}&currency=${displayCurrency}`;

    this.logger.log(
      `BETRA createDeposit deposit=${req.depositId} ext=${externalId} ` +
        `${displayAmount} ${displayCurrency}` +
        (req.exchangeRate ? ` (rate 1 AZN = ${req.exchangeRate} ${displayCurrency})` : ''),
    );
    return {
      externalId,
      paymentUrl,
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
