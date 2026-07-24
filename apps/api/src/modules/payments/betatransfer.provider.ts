import { createHash, timingSafeEqual } from 'node:crypto';
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import {
  type CreateDepositRequest,
  type CreateDepositResult,
  type ParsedWebhook,
  type PaymentProvider,
} from './payment-provider.interface';

/**
 * Шлюз Betatransfer.
 * Документация: https://docs.betatransfer.io/
 * Базовый URL: https://merchant.betatransfer.io
 *
 * Авторизация: публичный ключ в query (?token=...), тело — form-urlencoded.
 * Подпись запроса: md5(конкатенация значений всех параметров в порядке отправки + secret).
 * Депозит: POST /api/payment → получаем url платёжной страницы (редирект-флоу).
 * Вебхук: form-urlencoded POST на urlResult, подпись = md5(amount + orderId + secret).
 */
@Injectable()
export class BetatransferProvider implements PaymentProvider {
  readonly id = 'BETATRANSFER' as const;
  private readonly logger = new Logger(BetatransferProvider.name);
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly secret: string;
  private readonly callbackUrl: string;
  private readonly webPublicUrl: string;

  constructor() {
    this.baseUrl = (process.env.BETATRANSFER_API_URL || 'https://merchant.betatransfer.io').replace(/\/$/, '');
    this.token = process.env.BETATRANSFER_API_KEY || '';
    this.secret = process.env.BETATRANSFER_API_SECRET || '';
    this.callbackUrl = process.env.BETATRANSFER_CALLBACK_URL || '';
    this.webPublicUrl = (process.env.WEB_PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, '');
  }

  /** md5(значения параметров в порядке следования + secret) — подпись API-запроса. */
  private signRequest(params: Record<string, string>): string {
    const concatenated = Object.values(params).join('');
    return createHash('md5').update(concatenated + this.secret).digest('hex');
  }

  async createDeposit(req: CreateDepositRequest): Promise<CreateDepositResult> {
    const amount = req.convertedAmount ?? (Number(req.amountMinor) / 100).toFixed(2);
    const currency = (req.convertedCurrency ?? req.currency ?? 'AZN').toUpperCase();

    const cfg = (req.config ?? {}) as Record<string, unknown>;
    const paymentSystem = typeof cfg['paymentSystem'] === 'string' ? (cfg['paymentSystem'] as string) : '';

    // Порядок вставки важен: подпись = md5(конкатенация значений в этом порядке + secret).
    const params: Record<string, string> = {
      amount,
      currency,
      orderId: req.depositId,
      locale: req.locale === 'az' ? 'en' : 'ru', // az не поддерживается платёжной страницей
      urlSuccess: `${this.webPublicUrl}/deposit?status=success`,
      urlFail: `${this.webPublicUrl}/deposit?status=fail`,
      payerId: req.userId,
      fullCallback: '1',
    };
    if (this.callbackUrl) params.urlResult = this.callbackUrl;
    if (paymentSystem) params.paymentSystem = paymentSystem;
    params.sign = this.signRequest(params);

    const response = await fetch(`${this.baseUrl}/api/payment?token=${encodeURIComponent(this.token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });

    const text = await response.text();
    if (!response.ok) {
      this.logger.error(`Betatransfer createDeposit HTTP ${response.status}: ${text}`);
      throw new Error(`Betatransfer API error ${response.status}: ${text}`);
    }

    let json: {
      status?: string;
      id?: number;
      url?: string;
      urlPayment?: string;
      orderId?: string;
      hash?: string;
      message?: string;
    };
    try {
      json = JSON.parse(text) as typeof json;
    } catch {
      this.logger.error(`Betatransfer createDeposit non-JSON response: ${text}`);
      throw new Error('Betatransfer API returned non-JSON response');
    }

    // Старые версии API возвращают urlPayment вместо url
    const paymentUrl = json.url ?? json.urlPayment;
    if (!paymentUrl) {
      this.logger.error(`Betatransfer createDeposit failed: ${text}`);
      throw new Error(`Betatransfer API returned no payment url: ${json.message ?? text}`);
    }

    this.logger.log(
      `Betatransfer createDeposit order=${req.depositId} bt_id=${json.id ?? '—'} ${amount} ${currency}`,
    );

    return {
      // externalId = наш depositId (orderId): его Betatransfer вернёт в webhook как orderId
      externalId: req.depositId,
      paymentUrl,
      originalAmount: amount,
      originalCurrency: currency,
      exchangeRate: req.exchangeRate,
    };
  }

  verifyAndParseWebhook(_headers: Record<string, string>, rawBody: string): ParsedWebhook {
    // Betatransfer шлёт form-urlencoded: id, orderId, orderAmount, paidAmount, amount,
    // currency, status, sign, ... Подпись: sign = md5(amount + orderId + secret).
    const form = new URLSearchParams(rawBody);
    const payload: Record<string, string> = {};
    form.forEach((value, key) => {
      payload[key] = value;
    });

    const orderId = payload.orderId;
    if (!orderId) throw new BadRequestException('Missing orderId in webhook payload');

    const amount = payload.amount ?? '';
    const sign = payload.sign ?? '';
    if (!sign) throw new BadRequestException('Missing sign in webhook payload');

    const expected = createHash('md5').update(amount + orderId + this.secret).digest('hex');
    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(sign.toLowerCase());
    if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
      this.logger.warn(`Betatransfer signature mismatch orderId=${orderId}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    const status = mapBetatransferStatus(payload.status);

    // partial_payment: зачисляем фактически оплаченную сумму, а не запрошенную
    const isPartial = (payload.status ?? '').toLowerCase() === 'partial_payment';
    const receivedAmount = isPartial && payload.paidAmount ? payload.paidAmount : undefined;
    const receivedCurrency = isPartial && payload.paidAmount ? (payload.currency ?? 'AZN') : undefined;

    return {
      externalId: orderId,
      status,
      rawPayload: payload,
      receivedAmount,
      receivedCurrency,
    };
  }
}

/**
 * Маппинг статусов Betatransfer → внутренние статусы депозита.
 * См. https://docs.betatransfer.io/payment-withdrawal-statuses-1945734m0
 */
function mapBetatransferStatus(raw: string | undefined): ParsedWebhook['status'] {
  switch ((raw ?? '').toLowerCase()) {
    case 'success':
    case 'partial_payment':
      return 'COMPLETED';
    case 'not_paid_timeout':
      return 'EXPIRED';
    case 'cancel':
    case 'not_paid':
    case 'error':
    case 'blocked':
      return 'FAILED';
    // new / pending / checkPayment / verification — промежуточные, не трогаем депозит
    default:
      return 'PENDING';
  }
}
