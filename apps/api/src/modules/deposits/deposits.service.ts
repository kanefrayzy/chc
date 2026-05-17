import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import type { Deposit, PaymentProvider as PaymentProviderEnum, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.module';
import { PaymentProviderRegistry } from '../payments/payments.module';
import { PaymentMethodsService } from '../payment-methods/payment-methods.service';
import { SettingsService } from '../settings/settings.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

const DEPOSIT_EXPIRE_MINUTES = 15;

@Injectable()
export class DepositsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DepositsService.name);
  private expiryTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: PaymentProviderRegistry,
    private readonly settings: SettingsService,
    private readonly methods: PaymentMethodsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  onModuleInit(): void {
    // Каждую минуту переводим просроченные PENDING/PROCESSING депозиты в EXPIRED
    this.expiryTimer = setInterval(() => void this.expireOldDeposits(), 60_000);
  }

  onModuleDestroy(): void {
    if (this.expiryTimer) clearInterval(this.expiryTimer);
  }

  private async expireOldDeposits(): Promise<void> {
    try {
      const result = await this.prisma.deposit.updateMany({
        where: {
          status: { in: ['PENDING', 'PROCESSING'] },
          expiresAt: { lt: new Date() },
        },
        data: { status: 'EXPIRED' },
      });
      if (result.count > 0) {
        this.logger.log(`Auto-expired ${result.count} deposit(s)`);
      }
    } catch (e) {
      this.logger.error(`expireOldDeposits failed: ${String(e)}`);
    }
  }

  private async getGlobalLimits(): Promise<{ minMinor: bigint; maxMinor: bigint }> {
    const [minStr, maxStr] = await Promise.all([
      this.settings.get<string>('deposit.min_amount_minor'),
      this.settings.get<string>('deposit.max_amount_minor'),
    ]);
    return { minMinor: BigInt(minStr), maxMinor: BigInt(maxStr) };
  }

  async createDeposit(params: {
    userId: string;
    paymentMethodId: string;
    amountMinor: bigint;
  }): Promise<Deposit> {
    const { userId, paymentMethodId, amountMinor } = params;

    const method = await this.methods.getUsable(paymentMethodId, 'DEPOSIT');

    const provider: PaymentProviderEnum = method.provider;
    const isStaticWallet = provider === 'WESTWALLET';

    // Для WestWallet: если уже есть активный депозит с тем же методом — возвращаем его.
    // Адрес статичен, создавать новый не нужно. Сумма не обновляется — её задаст webhook.
    if (isStaticWallet) {
      const existing = await this.prisma.deposit.findFirst({
        where: { userId, paymentMethodId: method.id, status: { in: ['PENDING', 'PROCESSING'] } },
        orderBy: { createdAt: 'desc' },
      });
      if (existing) return existing;
    } else {
      // Для H2H провайдеров блокируем параллельные депозиты.
      // WestWallet депозиты не блокируют: статичный кошелёк всегда доступен параллельно.
      const activeDeposit = await this.prisma.deposit.findFirst({
        where: { userId, provider: { not: 'WESTWALLET' }, status: { in: ['PENDING', 'PROCESSING'] } },
        orderBy: { createdAt: 'desc' },
      });
      if (activeDeposit) {
        throw new ConflictException(
          'У вас уже есть активный счёт на оплату. Оплатите его или дождитесь истечения таймера.',
        );
      }
    }

    // Лимиты: только для H2H провайдеров — для WestWallet сумма определяется фактической оплатой.
    if (!isStaticWallet) {
      const global = await this.getGlobalLimits();
      const minMinor = method.minAmountMinor > 0n ? method.minAmountMinor : global.minMinor;
      const maxMinor = method.maxAmountMinor > 0n ? method.maxAmountMinor : global.maxMinor;
      if (amountMinor < minMinor || amountMinor > maxMinor) {
        throw new BadRequestException(
          `Amount must be between ${minMinor} and ${maxMinor} qəpik`,
        );
      }
    }

    const provImpl = this.providers.get(provider);

    // WestWallet — статичный кошелёк, не нужен таймер
    const expiresAt = isStaticWallet
      ? null
      : new Date(Date.now() + DEPOSIT_EXPIRE_MINUTES * 60 * 1000);

    // создаём запись со статусом PENDING, чтобы получить depositId
    const draft = await this.prisma.deposit.create({
      data: {
        userId,
        provider,
        paymentMethodId: method.id,
        amountMinor,
        status: 'PENDING',
        expiresAt,
      },
    });

    try {
      // Конвертируем AZN → валюту платёжного метода (если она не AZN)
      let convertedAmount: string | undefined;
      let convertedCurrency: string | undefined;
      let exchangeRateStr: string | undefined;

      const methodCurrency = (method.currency ?? '').toUpperCase();
      if (methodCurrency && methodCurrency !== 'AZN') {
        // USDT приравниваем к USD
        const rateSettingsKey =
          methodCurrency === 'USDT' ? 'exchange_rate.usd' : `exchange_rate.${methodCurrency.toLowerCase()}`;
        const rate = await this.settings.get<number>(rateSettingsKey).catch(() => null);
        if (rate && rate > 0) {
          const aznMajor = Number(amountMinor) / 100;
          convertedAmount = (aznMajor * rate).toFixed(2);
          convertedCurrency = methodCurrency;
          exchangeRateStr = String(rate);
        }
      }

      const result = await provImpl.createDeposit({
        depositId: draft.id,
        userId,
        amountMinor,
        config: (method.config ?? {}) as Record<string, unknown>,
        currency: method.currency,
        convertedAmount,
        convertedCurrency,
        exchangeRate: exchangeRateStr,
      });

      const updated = await this.prisma.deposit.update({
        where: { id: draft.id },
        data: {
          externalId: result.externalId,
          paymentUrl: result.paymentUrl ?? null,
          externalAddress: result.externalAddress ?? null,
          originalAmount: result.originalAmount ?? null,
          originalCurrency: result.originalCurrency ?? null,
          exchangeRate: result.exchangeRate ?? null,
          status: 'PROCESSING',
          // Если провайдер сигнализирует «без истечения», сбрасываем expiresAt в null
          expiresAt: result.noExpiry ? null : expiresAt,
        },
      });
      return updated;
    } catch (e) {
      this.logger.error(`Provider createDeposit failed for ${draft.id}: ${String(e)}`);
      await this.prisma.deposit.update({
        where: { id: draft.id },
        data: { status: 'FAILED' },
      });
      throw new BadRequestException('Failed to create deposit at provider');
    }
  }

  async listForUser(params: {
    userId: string;
    limit: number;
    cursor?: string | undefined;
  }): Promise<{ items: Deposit[]; nextCursor: string | null }> {
    const { userId, limit, cursor } = params;
    const take = Math.min(Math.max(limit, 1), 100);

    const items = await this.prisma.deposit.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    let nextCursor: string | null = null;
    if (items.length > take) {
      const next = items.pop();
      nextCursor = next?.id ?? null;
    }
    return { items, nextCursor };
  }

  /**
   * Применяет финальный статус депозита по данным webhook'а.
   * Идемпотентен: повторный вызов с тем же externalId не дублирует ledger.
   */
  async applyWebhook(params: {
    provider: PaymentProviderEnum;
    externalId: string;
    status: 'COMPLETED' | 'FAILED' | 'EXPIRED';
    rawPayload: unknown;
    receivedAmount?: string;
    receivedCurrency?: string;
  }): Promise<{ ok: true; alreadyProcessed: boolean }> {
    const deposit = await this.prisma.deposit.findUnique({
      where: { externalId: params.externalId },
    });
    if (!deposit) throw new NotFoundException('Deposit not found');
    if (deposit.provider !== params.provider) {
      throw new BadRequestException('Provider mismatch');
    }

    if (deposit.status === 'COMPLETED' || deposit.status === 'FAILED' || deposit.status === 'EXPIRED') {
      return { ok: true, alreadyProcessed: true };
    }

    if (params.status !== 'COMPLETED') {
      await this.prisma.deposit.update({
        where: { id: deposit.id },
        data: {
          status: params.status,
          rawWebhookPayload: params.rawPayload as Prisma.InputJsonValue,
        },
      });
      return { ok: true, alreadyProcessed: false };
    }

    // Если webhook передал фактически полученную сумму (WestWallet IPN) — конвертируем в AZN.
    // rate в настройках = сколько единиц валюты за 1 AZN (например USDT per AZN).
    let actualAmountMinor = deposit.amountMinor;
    if (params.receivedAmount && params.receivedCurrency) {
      // USDTTRC → USDT → USD
      const currency = params.receivedCurrency.toUpperCase().replace(/TRC\d*$/i, '');
      const settingsKey = (currency === 'USDT' || currency === 'USD')
        ? 'exchange_rate.usd'
        : `exchange_rate.${currency.toLowerCase()}`;
      const rate = await this.settings.get<number>(settingsKey).catch(() => null);
      if (rate && rate > 0) {
        // rate = валюта / AZN  →  AZN = received / rate
        const aznMajor = parseFloat(params.receivedAmount) / rate;
        const computed = BigInt(Math.round(aznMajor * 100));
        if (computed > 0n) {
          actualAmountMinor = computed;
          this.logger.log(
            `WestWallet IPN: received=${params.receivedAmount} ${currency}, rate=${rate}, AZN=${aznMajor.toFixed(2)}, minor=${computed}`,
          );
        }
      }
    }

    // COMPLETED → атомарно: deposit + transaction + balance + бонус (если настроен)
    const bonusBps = await this.settings.get<number>('deposit.bonus_bps');
    const bonusMinor = bonusBps > 0 ? (actualAmountMinor * BigInt(Math.round(bonusBps))) / 10_000n : 0n;
    const idempotencyKey = `deposit:${deposit.id}`;
    await this.prisma.$transaction(async (tx) => {
      const existingTx = await tx.transaction.findUnique({ where: { idempotencyKey } });
      if (existingTx) return; // защита от двойного применения

      const updatedUser = await tx.user.update({
        where: { id: deposit.userId },
        data: { balanceMinor: { increment: actualAmountMinor } },
        select: { balanceMinor: true },
      });

      await tx.transaction.create({
        data: {
          userId: deposit.userId,
          type: 'DEPOSIT',
          status: 'COMPLETED',
          amountMinor: actualAmountMinor,
          balanceAfterMinor: updatedUser.balanceMinor,
          idempotencyKey,
          referenceType: 'deposit',
          referenceId: deposit.id,
          description: `Deposit via ${deposit.provider}`,
        },
      });

      // Начисляем бонус отдельной транзакцией (идемпотентно)
      if (bonusMinor > 0n) {
        const bonusKey = `deposit:${deposit.id}:bonus`;
        const existingBonus = await tx.transaction.findUnique({ where: { idempotencyKey: bonusKey } });
        if (!existingBonus) {
          const afterBonus = await tx.user.update({
            where: { id: deposit.userId },
            data: { balanceMinor: { increment: bonusMinor } },
            select: { balanceMinor: true },
          });
          await tx.transaction.create({
            data: {
              userId: deposit.userId,
              type: 'ADMIN_CREDIT',
              status: 'COMPLETED',
              amountMinor: bonusMinor,
              balanceAfterMinor: afterBonus.balanceMinor,
              idempotencyKey: bonusKey,
              referenceType: 'deposit',
              referenceId: deposit.id,
              description: `Deposit bonus ${bonusBps / 100}% via ${deposit.provider}`,
            },
          });
          this.logger.log(`Deposit ${deposit.id} bonus ${bonusMinor} qəpik (${bonusBps} bps) credited`);
        }
      }

      await tx.deposit.update({
        where: { id: deposit.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          amountMinor: actualAmountMinor,   // обновляем на фактическую сумму в AZN
          rawWebhookPayload: params.rawPayload as Prisma.InputJsonValue,
        },
      });
    });

    this.logger.log(`Deposit ${deposit.id} COMPLETED via ${deposit.provider}`);

    // Уведомляем пользователя через WebSocket
    try {
      this.realtime.emitToUser(deposit.userId, 'deposit:updated', {
        depositId: deposit.id,
        status: 'COMPLETED',
      });
    } catch {
      // не блокируем
    }

    return { ok: true, alreadyProcessed: false };
  }
}
