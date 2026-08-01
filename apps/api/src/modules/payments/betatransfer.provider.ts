import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import {
  type CreateDepositRequest,
  type CreateDepositResult,
  type ParsedWebhook,
  type PaymentProvider,
} from './payment-provider.interface';

/**
 * Шлюз Betatransfer. Два флоу депозита:
 *
 * 1. **V2 P2R** (paymentSystem начинается с "P2R") — реквизиты выдаются сразу в ответе:
 *    POST https://api.betatransfer.io/v2/p2r/create (JSON), заголовки
 *    ApiKey / Timestamp / Signature = HMAC-SHA256(timestamp + body, secret).
 *    Ответ содержит requisite.data.card — показываем карту прямо на сайте.
 *    Статус заказа проверяется подписанным GET /v2/p2r/{id}.
 *
 * 2. **V1 redirect** (остальные системы, напр. Card_AZN эквайринг):
 *    POST https://merchant.betatransfer.io/api/payment?token=... (form-urlencoded),
 *    подпись md5(конкатенация значений в порядке отправки + secret) → url платёжной страницы.
 *
 * Вебхук (urlResult/callback.url): V1 шлёт form-urlencoded с sign = md5(amount+orderId+secret);
 * V2-заказы дополнительно верифицируются запросом GET /v2/p2r/{id} — колбэк служит триггером.
 * Документация: https://docs.betatransfer.io/ + "API Documentation V2".
 */
@Injectable()
export class BetatransferProvider implements PaymentProvider {
  readonly id = 'BETATRANSFER' as const;
  private readonly logger = new Logger(BetatransferProvider.name);
  private readonly baseUrl: string;
  private readonly v2BaseUrl: string;
  private readonly token: string;
  private readonly secret: string;
  private readonly callbackUrl: string;
  private readonly webPublicUrl: string;

  constructor() {
    this.baseUrl = (process.env.BETATRANSFER_API_URL || 'https://merchant.betatransfer.io').replace(/\/$/, '');
    this.v2BaseUrl = (process.env.BETATRANSFER_V2_API_URL || 'https://api.betatransfer.io/v2').replace(/\/$/, '');
    this.token = process.env.BETATRANSFER_API_KEY || '';
    this.secret = process.env.BETATRANSFER_API_SECRET || '';
    this.callbackUrl = process.env.BETATRANSFER_CALLBACK_URL || '';
    this.webPublicUrl = (process.env.WEB_PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, '');
  }

  // ── подписи ──────────────────────────────────────────────────────────

  /** V1: md5(значения параметров в порядке следования + secret). */
  private signV1Request(params: Record<string, string>): string {
    const concatenated = Object.values(params).join('');
    return createHash('md5').update(concatenated + this.secret).digest('hex');
  }

  /** V2: HMAC-SHA256(timestamp + body, secret), hex. */
  private signV2(timestamp: string, body: string): string {
    return createHmac('sha256', this.secret).update(timestamp + body).digest('hex');
  }

  private v2Headers(body: string): Record<string, string> {
    const ts = String(Math.floor(Date.now() / 1000));
    return {
      ApiKey: this.token,
      Timestamp: ts,
      Signature: this.signV2(ts, body),
      'Content-Type': 'application/json',
    };
  }

  // ── создание депозита ────────────────────────────────────────────────

  async createDeposit(req: CreateDepositRequest): Promise<CreateDepositResult> {
    const cfg = (req.config ?? {}) as Record<string, unknown>;
    const paymentSystem = typeof cfg['paymentSystem'] === 'string' ? (cfg['paymentSystem'] as string) : '';

    // P2R-системы идут через V2 API с выдачей реквизитов, остальные — V1 redirect
    if (/^p2r/i.test(paymentSystem)) {
      return this.createDepositV2(req, paymentSystem);
    }
    return this.createDepositV1(req, paymentSystem);
  }

  /** V2 P2R: реквизиты (номер карты) возвращаются сразу в ответе. */
  private async createDepositV2(req: CreateDepositRequest, method: string): Promise<CreateDepositResult> {
    const amount = req.convertedAmount ?? (Number(req.amountMinor) / 100).toFixed(2);
    const currency = (req.convertedCurrency ?? req.currency ?? 'AZN').toUpperCase();

    const body = JSON.stringify({
      order_id: req.depositId,
      payment: {
        amount,
        currency,
        description: `Deposit ${req.depositId}`,
        method,
        allow_modify_amount: true,
      },
      return_url: {
        success: `${this.webPublicUrl}/deposit?status=success`,
        failure: `${this.webPublicUrl}/deposit?status=fail`,
      },
      ...(this.callbackUrl ? { callback: { url: this.callbackUrl } } : {}),
      customer: {
        id: req.userId,
        language: req.locale === 'az' ? 'en' : 'ru',
      },
    });

    const response = await fetch(`${this.v2BaseUrl}/p2r/create`, {
      method: 'POST',
      headers: this.v2Headers(body),
      body,
    });

    const text = await response.text();
    if (!response.ok) {
      this.logger.error(`Betatransfer v2 create HTTP ${response.status}: ${text}`);
      throw new Error(`Betatransfer v2 API error ${response.status}: ${text}`);
    }

    let json: {
      id?: string | number;
      order_id?: string;
      status?: string;
      payment?: { awaiting_amount?: string; awaiting_currency?: string };
      requisite?: { type?: string; data?: Record<string, string | null> };
      processing?: { url?: string };
      expired_at?: string;
    };
    try {
      json = JSON.parse(text) as typeof json;
    } catch {
      this.logger.error(`Betatransfer v2 create non-JSON response: ${text}`);
      throw new Error('Betatransfer v2 API returned non-JSON response');
    }

    const btId = json.id !== undefined ? String(json.id) : '';
    if (!btId) {
      this.logger.error(`Betatransfer v2 create failed: ${text}`);
      throw new Error('Betatransfer v2 API returned no order id');
    }

    // Реквизит для перевода: карта / iban / кошелёк — берём первое непустое поле data
    const reqData = json.requisite?.data ?? {};
    const externalAddress =
      reqData['card'] ?? reqData['iban'] ?? reqData['wallet'] ?? reqData['address'] ?? undefined;

    const awaitingAmount = json.payment?.awaiting_amount ?? amount;
    const awaitingCurrency = json.payment?.awaiting_currency ?? currency;

    this.logger.log(
      `Betatransfer v2 createDeposit order=${req.depositId} bt_id=${btId} ` +
        `${awaitingAmount} ${awaitingCurrency} requisite=${externalAddress ? '****' + String(externalAddress).slice(-4) : '—'} ` +
        `bank=${reqData['bank_name'] ?? '—'}`,
    );

    const requisiteDetails: { type?: string; bank?: string; owner?: string } = {};
    if (json.requisite?.type) requisiteDetails.type = json.requisite.type;
    if (reqData['bank_name']) requisiteDetails.bank = reqData['bank_name'] as string;
    if (reqData['card_owner']) requisiteDetails.owner = reqData['card_owner'] as string;

    return {
      // externalId = наш depositId: именно его Betatransfer присылает в колбэке как orderId
      externalId: req.depositId,
      externalAddress: externalAddress ?? undefined,
      ...(Object.keys(requisiteDetails).length > 0 ? { requisiteDetails } : {}),
      // Платёжную страницу не показываем: оплата идёт переводом по реквизитам (H2H)
      originalAmount: awaitingAmount,
      originalCurrency: awaitingCurrency,
      exchangeRate: req.exchangeRate,
      expiresAt: json.expired_at,
    };
  }

  /** V1: редирект-флоу (эквайринг и другие не-P2R системы). */
  private async createDepositV1(req: CreateDepositRequest, paymentSystem: string): Promise<CreateDepositResult> {
    const amount = req.convertedAmount ?? (Number(req.amountMinor) / 100).toFixed(2);
    const currency = (req.convertedCurrency ?? req.currency ?? 'AZN').toUpperCase();

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
    params.sign = this.signV1Request(params);

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

  // ── выплаты (payout) ─────────────────────────────────────────────────

  /**
   * Создаёт выплату на карту: POST /api/withdrawal-payment (form-urlencoded).
   *
   * Сумму задаём как `paymentAmount` + `paymentCurrency` — это то, что получит
   * клиент на карту (AZN). Списание с баланса мерчанта в USD провайдер посчитает
   * сам по своему курсу, поэтому игрок всегда получает ровно запрошенную сумму.
   */
  async createPayout(req: {
    withdrawalId: string;
    amountMinor: bigint;
    currency?: string;
    cardNumber: string;
    holderFirstName?: string;
    holderLastName?: string;
    paymentSystem: string;
    callbackUrl?: string;
  }): Promise<{ externalId: string; raw: unknown }> {
    if (!this.token || !this.secret) {
      throw new Error('BETATRANSFER credentials are not configured');
    }

    const amount = (Number(req.amountMinor) / 100).toFixed(2);
    const card = req.cardNumber.replace(/\D/g, '');

    // Порядок важен: подпись = md5(конкатенация значений в этом порядке + secret)
    const params: Record<string, string> = {
      paymentAmount: amount,
      paymentCurrency: (req.currency ?? 'AZN').toUpperCase(),
      orderId: req.withdrawalId,
      paymentSystem: req.paymentSystem,
      address: card,
    };
    if (req.holderFirstName) params.receiverFirstName = req.holderFirstName;
    if (req.holderLastName) params.receiverLastName = req.holderLastName;
    if (req.callbackUrl) params.urlResult = req.callbackUrl;
    params.sign = this.signV1Request(params);

    const response = await fetch(
      `${this.baseUrl}/api/withdrawal-payment?token=${encodeURIComponent(this.token)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString(),
      },
    );

    const text = await response.text();
    if (!response.ok) {
      this.logger.error(`Betatransfer payout HTTP ${response.status}: ${text}`);
      throw new Error(`Betatransfer payout error ${response.status}: ${text}`);
    }

    let json: { status?: string; id?: number | string; message?: string; errors?: unknown };
    try {
      json = JSON.parse(text) as typeof json;
    } catch {
      throw new Error('Betatransfer payout returned non-JSON response');
    }

    if (json.id === undefined || (json.status && json.status !== 'success')) {
      this.logger.error(`Betatransfer payout rejected: ${text}`);
      throw new Error(`Betatransfer payout rejected: ${json.message ?? text}`);
    }

    this.logger.log(
      `Betatransfer payout order=${req.withdrawalId} bt_id=${json.id} ${amount} ${params.paymentCurrency} → ****${card.slice(-4)}`,
    );
    return { externalId: String(json.id), raw: json };
  }

  /**
   * Колбэк о статусе выплаты (form-urlencoded, подпись md5(amount + orderId + secret)).
   * Статусы: success — выплачено, cancel — отменено провайдером (нужен возврат средств).
   */
  verifyPayoutWebhook(rawBody: string): {
    withdrawalId: string;
    status: 'COMPLETED' | 'FAILED' | 'PENDING';
    rawPayload: Record<string, string>;
  } {
    const form = new URLSearchParams(rawBody);
    const payload: Record<string, string> = {};
    form.forEach((value, key) => {
      payload[key] = value;
    });

    const orderId = payload.orderId;
    if (!orderId) throw new BadRequestException('Missing orderId in payout webhook');
    if (!this.secret) {
      this.logger.error('BETATRANSFER_API_SECRET is not set — rejecting payout webhook');
      throw new BadRequestException('Webhook verification unavailable');
    }

    const expected = createHash('md5')
      .update((payload.amount ?? '') + orderId + this.secret)
      .digest('hex');
    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from((payload.sign ?? '').toLowerCase());
    if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
      this.logger.warn(`Betatransfer payout signature mismatch orderId=${orderId}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    const raw = (payload.status ?? '').toLowerCase();
    const status: 'COMPLETED' | 'FAILED' | 'PENDING' =
      raw === 'success' || raw === 'partial_withdraw'
        ? 'COMPLETED'
        : raw === 'cancel' || raw === 'error' || raw === 'blocked'
          ? 'FAILED'
          : 'PENDING';

    this.logger.log(`Betatransfer payout webhook order=${orderId} status=${raw} → ${status}`);
    return { withdrawalId: orderId, status, rawPayload: payload };
  }

  // ── вебхуки ──────────────────────────────────────────────────────────

  async verifyAndParseWebhook(_headers: Record<string, string>, rawBody: string): Promise<ParsedWebhook> {
    // Betatransfer шлёт колбэк form-urlencoded (в том числе для заказов, созданных
    // через V2 P2R): `id` — номер заказа у провайдера, `orderId` — наш depositId.
    const trimmed = rawBody.trim();
    let payload: Record<string, unknown>;
    if (trimmed.startsWith('{')) {
      try {
        payload = JSON.parse(trimmed) as Record<string, unknown>;
      } catch {
        throw new BadRequestException('Invalid JSON webhook body');
      }
    } else {
      const form = new URLSearchParams(rawBody);
      const obj: Record<string, string> = {};
      form.forEach((value, key) => {
        obj[key] = value;
      });
      payload = obj;
    }

    const btId = payload.id !== undefined ? String(payload.id as string | number) : '';

    // Подписанный колбэк — основная проверка подлинности.
    if (typeof payload.sign === 'string' && typeof payload.orderId === 'string') {
      return this.parseSignedWebhook(payload as Record<string, string>, btId);
    }

    // Без подписи доверять нечему — статус берём из подписанного запроса к API.
    if (btId) {
      return this.verifyV2ByOrderInfo(btId, payload);
    }

    throw new BadRequestException('Unrecognized webhook payload');
  }

  /**
   * Колбэк с подписью `md5(amount + orderId + secret)`.
   * `externalId` — наш depositId (в колбэке это `orderId`).
   */
  private async parseSignedWebhook(
    payload: Record<string, string>,
    btId: string,
  ): Promise<ParsedWebhook> {
    const orderId = payload.orderId;
    const amount = payload.amount ?? '';
    const sign = payload.sign ?? '';

    // Fail closed: с пустым секретом подпись вырождается в md5(amount+orderId),
    // которую может вычислить кто угодно.
    if (!this.secret) {
      this.logger.error('BETATRANSFER_API_SECRET is not set — rejecting unverifiable webhook');
      throw new BadRequestException('Webhook verification unavailable');
    }

    const expected = createHash('md5').update(amount + orderId + this.secret).digest('hex');
    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(sign.toLowerCase());
    if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
      this.logger.warn(`Betatransfer signature mismatch orderId=${orderId}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    let status = mapV1Status(payload.status);

    // Дополнительная сверка статуса с API (защита от повтора устаревшего колбэка).
    // Недоступность API не отменяет корректную подпись — только логируем.
    if (btId) {
      try {
        const info = await this.fetchV2Order(btId);
        if (info) {
          const apiStatus = mapV2Status(info.status);
          if (apiStatus !== status) {
            this.logger.warn(
              `Betatransfer status mismatch order=${orderId}: callback=${payload.status} api=${info.status} — берём данные API`,
            );
            status = apiStatus;
          }
        }
      } catch (e) {
        this.logger.warn(`Betatransfer API cross-check failed for ${btId}: ${String(e)}`);
      }
    }

    // Зачисляем сумму, которую фактически заплатил игрок (paidAmount),
    // а не сумму за вычетом комиссии провайдера (amount) — комиссию платит казино.
    const paid = payload.paidAmount;
    const receivedAmount = paid && Number(paid) > 0 ? paid : undefined;
    const receivedCurrency = receivedAmount ? (payload.currency ?? 'AZN') : undefined;

    this.logger.log(
      `Betatransfer webhook order=${orderId} bt_id=${btId || '—'} status=${payload.status} → ${status} paid=${paid ?? '—'}`,
    );

    return { externalId: orderId, status, rawPayload: payload, receivedAmount, receivedCurrency };
  }

  /** Данные заказа из V2 API; null — если заказа там нет (создан не через P2R). */
  private async fetchV2Order(btId: string): Promise<{ status?: string } | null> {
    const ts = String(Math.floor(Date.now() / 1000));
    const response = await fetch(`${this.v2BaseUrl}/p2r/${encodeURIComponent(btId)}`, {
      method: 'GET',
      headers: {
        ApiKey: this.token,
        Timestamp: ts,
        Signature: this.signV2(ts, ''),
        'Content-Type': 'application/json',
      },
    });
    if (response.status === 404) return null;
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${text}`);
    return JSON.parse(text) as { status?: string };
  }

  /** Авторитетная проверка V2-заказа: GET /v2/p2r/{id} с HMAC-подписью timestamp. */
  private async verifyV2ByOrderInfo(btId: string, callbackPayload: unknown): Promise<ParsedWebhook> {
    const ts = String(Math.floor(Date.now() / 1000));
    const response = await fetch(`${this.v2BaseUrl}/p2r/${encodeURIComponent(btId)}`, {
      method: 'GET',
      headers: {
        ApiKey: this.token,
        Timestamp: ts,
        Signature: this.signV2(ts, ''),
        'Content-Type': 'application/json',
      },
    });

    const text = await response.text();
    if (!response.ok) {
      this.logger.warn(`Betatransfer v2 order info ${btId} HTTP ${response.status}: ${text}`);
      throw new BadRequestException('Betatransfer order verification failed');
    }

    let info: {
      id?: string | number;
      order_id?: string;
      status?: string;
      payment?: {
        customer_amount?: string | null;
        customer_currency?: string | null;
        currency?: string;
      };
    };
    try {
      info = JSON.parse(text) as typeof info;
    } catch {
      throw new BadRequestException('Betatransfer order verification returned non-JSON');
    }

    const status = mapV2Status(info.status);

    // Зачисляем фактически оплаченную сумму, если провайдер её сообщил
    const customerAmount = info.payment?.customer_amount ?? undefined;
    const receivedAmount = status === 'COMPLETED' && customerAmount ? customerAmount : undefined;
    const receivedCurrency = receivedAmount
      ? (info.payment?.customer_currency ?? info.payment?.currency ?? 'AZN')
      : undefined;

    return {
      externalId: btId,
      status,
      rawPayload: { callback: callbackPayload, orderInfo: info },
      receivedAmount,
      receivedCurrency,
    };
  }
}

/**
 * Маппинг статусов Betatransfer V1 → внутренние статусы депозита.
 * См. https://docs.betatransfer.io/payment-withdrawal-statuses-1945734m0
 */
function mapV1Status(raw: string | undefined): ParsedWebhook['status'] {
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

/** Маппинг статусов Betatransfer V2 (processing|paid|partial_paid|expired|failed). */
function mapV2Status(raw: string | undefined): ParsedWebhook['status'] {
  switch ((raw ?? '').toLowerCase()) {
    case 'paid':
    case 'partial_paid':
      return 'COMPLETED';
    case 'expired':
      return 'EXPIRED';
    case 'failed':
      return 'FAILED';
    // processing и прочие — промежуточные
    default:
      return 'PENDING';
  }
}
