import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import {
  type CreateDepositRequest,
  type CreateDepositResult,
  type ParsedWebhook,
  type PaymentProvider,
} from './payment-provider.interface';

/**
 * WestWallet (криптовалютные депозиты, USDT).
 *
 * MVP-stub: фиксированный курс AZN→USDT для preview-окружения,
 * фейковый адрес кошелька + HMAC-SHA256 проверка webhook'а.
 */
@Injectable()
export class WestWalletProvider implements PaymentProvider {
  readonly id = 'WESTWALLET' as const;
  private readonly logger = new Logger(WestWalletProvider.name);
  private readonly secret: string;
  /** Курс AZN→USDT, мажорные единицы (1 AZN = rate USDT). */
  private readonly rate: number;

  constructor() {
    this.secret = process.env.WESTWALLET_WEBHOOK_SECRET || 'dev-west-secret';
    this.rate = Number(process.env.WESTWALLET_AZN_USDT_RATE || '0.59');
  }

  async createDeposit(req: CreateDepositRequest): Promise<CreateDepositResult> {
    const externalId = `wst_${randomUUID()}`;
    const address = `T${randomUUID().replace(/-/g, '').slice(0, 33).toUpperCase()}`;

    // Предпочитаем сконвертированное значение из DepositsService (из exchange_rate.usd),
    // иначе фолбэк на старый env-var rate (для обратной совместимости в dev).
    const usdt = req.convertedAmount ?? ((Number(req.amountMinor) / 100) * this.rate).toFixed(2);
    const exchangeRate = req.exchangeRate ?? this.rate.toString();

    this.logger.log(
      `WESTWALLET createDeposit deposit=${req.depositId} ext=${externalId} usdt=${usdt}`,
    );
    return {
      externalId,
      externalAddress: address,
      originalAmount: usdt,
      originalCurrency: 'USDT',
      exchangeRate,
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

    const status = mapWestStatus(payload.status);
    return { externalId: payload.externalId, status, rawPayload: payload };
  }
}

function mapWestStatus(raw: string | undefined): ParsedWebhook['status'] {
  switch ((raw ?? '').toLowerCase()) {
    case 'confirmed':
    case 'completed':
    case 'success':
      return 'COMPLETED';
    case 'expired':
    case 'timeout':
      return 'EXPIRED';
    default:
      return 'FAILED';
  }
}
