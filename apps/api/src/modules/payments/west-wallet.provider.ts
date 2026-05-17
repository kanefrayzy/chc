import { createHmac } from 'node:crypto';
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import {
  type CreateDepositRequest,
  type CreateDepositResult,
  type ParsedWebhook,
  type PaymentProvider,
} from './payment-provider.interface';

/**
 * WestWallet — криптовалютные депозиты (USDT TRC-20, BTC и др.).
 * Docs: https://docs.westwallet.io/en
 *
 * Авторизация: X-API-KEY + X-ACCESS-SIGN (HMAC-SHA256 timestamp\nbody).
 * Депозит: POST /address/generate → статичный адрес кошелька (label = depositId[:30]).
 * Webhook: IPN x-www-form-urlencoded; Security via IP 5.188.51.47 (enforce at nginx).
 * Anti-spoofing: при необходимости — вызов POST /wallet/transaction для проверки статуса.
 */
@Injectable()
export class WestWalletProvider implements PaymentProvider {
  readonly id = 'WESTWALLET' as const;
  private readonly logger = new Logger(WestWalletProvider.name);
  private readonly apiKey: string;
  private readonly privateKey: string;
  private readonly ipnUrl: string;
  private readonly baseUrl = 'https://api.westwallet.io';

  constructor() {
    this.apiKey = process.env.WESTWALLET_PUBLIC_KEY ?? process.env.WESTWALLET_API_KEY ?? '';
    this.privateKey = process.env.WESTWALLET_PRIVATE_KEY ?? '';
    this.ipnUrl = process.env.WESTWALLET_IPN_URL ?? '';
  }

  /** Формирует заголовки авторизации для запросов к API WestWallet. */
  private buildAuthHeaders(body: Record<string, unknown>): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyJson = JSON.stringify(body);
    // Ключ WestWallet передаётся в формате base64url — декодируем в raw-байты перед HMAC
    const keyBytes = Buffer.from(this.privateKey, 'base64url');
    const sign = createHmac('sha256', keyBytes)
      .update(`${timestamp}\n${bodyJson}`)
      .digest('hex');
    return {
      'Content-Type': 'application/json',
      'X-API-KEY': this.apiKey,
      'X-ACCESS-SIGN': sign,
      'X-ACCESS-TIMESTAMP': timestamp,
    };
  }

  async createDeposit(req: CreateDepositRequest): Promise<CreateDepositResult> {
    const cfg = (req.config ?? {}) as Record<string, unknown>;
    const ticker = (cfg['ticker'] as string | undefined) ?? 'USDTTRC';

    // label: наш depositId, макс. 30 символов — WestWallet вернёт его в IPN
    const label = req.depositId.slice(0, 30);

    // USDT TRC-20 ≈ USD, используем сконвертированную сумму из DepositsService
    const usdtAmount = req.convertedAmount ?? (Number(req.amountMinor) / 100).toFixed(2);
    const usdtCurrency = ticker === 'USDTTRC' ? 'USDT' : ticker;

    // Если ключи не настроены — возвращаем stub для dev-окружения
    if (!this.apiKey || !this.privateKey) {
      this.logger.warn('WESTWALLET_API_KEY not configured — returning stub address for dev');
      return {
        externalId: req.depositId,
        externalAddress: 'TStubWestWalletAddress00000000000',
        originalAmount: usdtAmount,
        originalCurrency: usdtCurrency,
        exchangeRate: req.exchangeRate,
        noExpiry: true,
      };
    }

    const body: Record<string, unknown> = { currency: ticker, label };
    if (this.ipnUrl) body.ipn_url = this.ipnUrl;

    const response = await fetch(`${this.baseUrl}/address/generate`, {
      method: 'POST',
      headers: this.buildAuthHeaders(body),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.error(`WestWallet address/generate HTTP ${response.status}: ${text}`);
      throw new Error(`WestWallet API error ${response.status}`);
    }

    const json = (await response.json()) as {
      address?: string;
      dest_tag?: string;
      currency?: string;
      label?: string;
      error?: string;
    };

    if (json.error && json.error !== 'ok') {
      this.logger.error(`WestWallet address/generate error: ${json.error}`);
      throw new Error(`WestWallet error: ${json.error}`);
    }

    if (!json.address) throw new Error('WestWallet did not return address');

    this.logger.log(
      `WestWallet createDeposit deposit=${req.depositId} ticker=${ticker} addr=...${json.address.slice(-6)}`,
    );

    return {
      externalId: req.depositId,      // label = depositId → используется при поиске по webhook
      externalAddress: json.address,
      originalAmount: usdtAmount,
      originalCurrency: usdtCurrency,
      exchangeRate: req.exchangeRate,
      noExpiry: true,                  // статичный кошелёк не имеет таймера
    };
  }

  /**
   * WestWallet отправляет IPN как application/x-www-form-urlencoded.
   * Безопасность — через IP-фильтрацию (5.188.51.47) на уровне nginx/firewall.
   * Docs: "To prevent spoofing, check status additionally via POST /wallet/transaction"
   */
  verifyAndParseWebhook(_headers: Record<string, string>, rawBody: string): ParsedWebhook {
    // Парсим form-urlencoded тело
    let params: URLSearchParams;
    try {
      params = new URLSearchParams(rawBody);
    } catch {
      throw new BadRequestException('Invalid IPN body from WestWallet');
    }

    // label = наш depositId (передаём при address/generate)
    const label = params.get('label');
    if (!label) throw new BadRequestException('Missing label in WestWallet IPN');

    const status = params.get('status');
    const rawPayload = Object.fromEntries(params.entries());

    this.logger.log(
      `WestWallet IPN: label=${label} status=${status} amount=${params.get('amount') ?? '?'} ` +
        `currency=${params.get('currency') ?? '?'}`,
    );

    // Фактически полученная сумма в USDT — DepositsService конвертирует в AZN
    const receivedAmount = params.get('amount') ?? undefined;
    const receivedCurrency = params.get('currency') ?? undefined;

    return {
      externalId: label, // label совпадает с Deposit.externalId (= depositId)
      status: mapWestStatus(status),
      rawPayload,
      receivedAmount,
      receivedCurrency,
    };
  }
}

function mapWestStatus(raw: string | null): ParsedWebhook['status'] {
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

