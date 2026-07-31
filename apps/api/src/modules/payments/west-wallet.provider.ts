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
    // Формат подписи согласно официальной JS-библиотеке WestWallet:
    // sign = HMAC-SHA256(secretKey, timestamp + bodyJson) — без разделителя, ключ — сырая строка
    const sign = createHmac('sha256', this.privateKey)
      .update(`${timestamp}${bodyJson}`)
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
   * WestWallet отправляет IPN как application/x-www-form-urlencoded, но НЕ подписывает его.
   * Поэтому телу вебхука не доверяем вообще: он служит только триггером, а статус и сумма
   * берутся из подписанного запроса POST /wallet/transaction (рекомендация документации
   * «To prevent spoofing, check status additionally»). Без этого любой мог бы начислить
   * себе произвольный баланс, зная id депозита.
   */
  async verifyAndParseWebhook(
    _headers: Record<string, string>,
    rawBody: string,
  ): Promise<ParsedWebhook> {
    let params: URLSearchParams;
    try {
      params = new URLSearchParams(rawBody);
    } catch {
      throw new BadRequestException('Invalid IPN body from WestWallet');
    }

    // label = наш depositId (передаём при address/generate)
    const label = params.get('label');
    if (!label) throw new BadRequestException('Missing label in WestWallet IPN');

    const txId = params.get('id');
    if (!txId) throw new BadRequestException('Missing transaction id in WestWallet IPN');

    this.logger.log(`WestWallet IPN received: label=${label} tx=${txId} — verifying via API`);

    // Fail closed: без ключей проверить подлинность невозможно.
    if (!this.apiKey || !this.privateKey) {
      this.logger.error('WestWallet keys not configured — rejecting unverifiable IPN');
      throw new BadRequestException('WestWallet verification unavailable');
    }

    const verified = await this.fetchTransaction(txId);

    // Транзакция должна относиться к тому же депозиту, что указан в IPN
    if (verified.label && verified.label !== label) {
      this.logger.warn(`WestWallet IPN label mismatch: ipn=${label} api=${verified.label}`);
      throw new BadRequestException('WestWallet label mismatch');
    }

    this.logger.log(
      `WestWallet verified: label=${label} status=${verified.status} amount=${verified.amount ?? '?'} ` +
        `currency=${verified.currency ?? '?'}`,
    );

    return {
      externalId: label, // label совпадает с Deposit.externalId (= depositId)
      status: mapWestStatus(verified.status ?? null),
      rawPayload: { ipn: Object.fromEntries(params.entries()), verified },
      receivedAmount: verified.amount ?? undefined,
      receivedCurrency: verified.currency ?? undefined,
    };
  }

  /** Авторитетные данные транзакции из API WestWallet (подписанный запрос). */
  private async fetchTransaction(id: string): Promise<{
    status?: string;
    amount?: string;
    currency?: string;
    label?: string;
  }> {
    const body: Record<string, unknown> = { id };
    const response = await fetch(`${this.baseUrl}/wallet/transaction`, {
      method: 'POST',
      headers: this.buildAuthHeaders(body),
      body: JSON.stringify(body),
    });

    const text = await response.text();
    if (!response.ok) {
      this.logger.error(`WestWallet transaction lookup HTTP ${response.status}: ${text}`);
      throw new BadRequestException('WestWallet verification failed');
    }

    let json: {
      status?: string;
      amount?: string | number;
      currency?: string;
      label?: string;
      error?: string;
    };
    try {
      json = JSON.parse(text) as typeof json;
    } catch {
      throw new BadRequestException('WestWallet verification returned non-JSON');
    }

    if (json.error && json.error !== 'ok') {
      this.logger.error(`WestWallet transaction lookup error: ${json.error}`);
      throw new BadRequestException('WestWallet verification error');
    }

    return {
      ...(json.status !== undefined ? { status: json.status } : {}),
      ...(json.amount !== undefined ? { amount: String(json.amount) } : {}),
      ...(json.currency !== undefined ? { currency: json.currency } : {}),
      ...(json.label !== undefined ? { label: json.label } : {}),
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

