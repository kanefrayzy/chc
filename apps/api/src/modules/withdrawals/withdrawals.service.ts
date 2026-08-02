import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import type { Prisma, Withdrawal, WithdrawalMethod, PaymentProvider as PaymentProviderEnum } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.module';
import { debitBalance } from '../../common/balance';
import { PaymentMethodsService } from '../payment-methods/payment-methods.service';
import { SettingsService } from '../settings/settings.service';
import { BetatransferProvider } from '../payments/betatransfer.provider';

const DEFAULT_MAX_MINOR = 1_000_000n; // 10 000 AZN (страховочный потолок)

@Injectable()
export class WithdrawalsService {
  private readonly logger = new Logger(WithdrawalsService.name);
  private readonly maxMinorFallback: bigint;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly methods: PaymentMethodsService,
    private readonly betatransfer: BetatransferProvider,
  ) {
    this.maxMinorFallback = BigInt(process.env.WITHDRAWAL_MAX_MINOR ?? DEFAULT_MAX_MINOR.toString());
  }

  private async getMinMinor(): Promise<bigint> {
    const raw = await this.settings.get<string>('withdrawal.min_amount_minor');
    return BigInt(raw);
  }

  /** Маппинг провайдера PaymentMethod → внутренний enum WithdrawalMethod. */
  private providerToMethod(provider: PaymentProviderEnum): WithdrawalMethod {
    return provider === 'BETATRANSFER' ? 'AUTO_BETATRANSFER' : 'AUTO_WESTWALLET';
  }

  /** Режим выплат из настроек: manual | semi | auto. */
  async getAutoMode(): Promise<'manual' | 'semi' | 'auto'> {
    const raw = await this.settings.get<string>('withdrawal.auto_mode').catch(() => 'manual');
    return raw === 'auto' || raw === 'semi' ? raw : 'manual';
  }

  /** Порог, выше которого выплата всегда уходит модератору. */
  private async getManualThresholdMinor(): Promise<bigint> {
    try {
      const raw = await this.settings.get<string>('withdrawal.manual_threshold_minor');
      return BigInt(raw);
    } catch {
      return 0n;
    }
  }

  /**
   * Отправляет выплату провайдеру. Возвращает externalId или null, если
   * автовыплата неприменима (другой провайдер, не карта, сумма выше порога).
   * Ошибка провайдера не роняет заявку — она останется модератору.
   */
  async sendPayout(withdrawalId: string): Promise<string | null> {
    const w = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
      include: { paymentMethod: true },
    });
    if (!w) throw new NotFoundException('WITHDRAWAL_NOT_FOUND');
    if (w.method !== 'AUTO_BETATRANSFER') return null;

    const threshold = await this.getManualThresholdMinor();
    if (threshold > 0n && w.amountMinor > threshold) {
      this.logger.log(
        `Withdrawal ${w.id}: ${w.amountMinor} выше порога ${threshold} — отправляем модератору`,
      );
      return null;
    }

    const dest = (w.destination ?? {}) as Record<string, unknown>;
    const cardNumber = typeof dest.cardNumber === 'string' ? dest.cardNumber : '';
    if (!cardNumber) return null;

    const holder = typeof dest.cardHolder === 'string' ? dest.cardHolder.trim() : '';
    const [firstName, ...restName] = holder.split(/\s+/).filter(Boolean);

    // Платёжная система выплаты: сперва из настроек метода (config.payoutPaymentSystem),
    // затем глобальная настройка, затем дефолт провайдера.
    const methodConfig = (w.paymentMethod?.config ?? {}) as Record<string, unknown>;
    const configuredSystem =
      typeof methodConfig.payoutPaymentSystem === 'string' ? methodConfig.payoutPaymentSystem : '';
    const paymentSystem =
      configuredSystem ||
      (await this.settings.get<string>('withdrawal.payout_payment_system').catch(() => '')) ||
      'USD_CardAZN';

    const payout = await this.betatransfer.createPayout({
      withdrawalId: w.id,
      amountMinor: w.amountMinor,
      currency: w.paymentMethod?.currency ?? 'AZN',
      cardNumber,
      ...(firstName ? { holderFirstName: firstName } : {}),
      ...(restName.length > 0 ? { holderLastName: restName.join(' ') } : {}),
      paymentSystem,
      ...(process.env.BETATRANSFER_PAYOUT_CALLBACK_URL
        ? { callbackUrl: process.env.BETATRANSFER_PAYOUT_CALLBACK_URL }
        : {}),
    });

    await this.prisma.withdrawal.updateMany({
      where: { id: w.id, status: { in: ['PENDING', 'PROCESSING'] } },
      data: { status: 'PROCESSING', externalId: payout.externalId },
    });
    return payout.externalId;
  }

  /**
   * Спрашивает у провайдера текущее состояние выплаты и, если оно финальное,
   * применяет его как обычный колбэк. Нужен, когда колбэк не дошёл: заявка
   * иначе висит в PROCESSING без признаков жизни.
   */
  async syncPayoutStatus(withdrawalId: string): Promise<{
    applied: boolean;
    status: 'COMPLETED' | 'FAILED' | 'PENDING';
    providerStatus: string;
    providerId: string | null;
    amount: string | null;
    currency: string | null;
    commission: string | null;
    paymentSystem: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  }> {
    const w = await this.prisma.withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!w) throw new NotFoundException('WITHDRAWAL_NOT_FOUND');
    if (w.method !== 'AUTO_BETATRANSFER') throw new BadRequestException('PAYOUT_NOT_AUTOMATED');

    const info = await this.betatransfer.fetchPayoutInfo(w.id);

    let applied = false;
    if (info.status !== 'PENDING') {
      const flat: Record<string, string> = {};
      for (const [key, value] of Object.entries(info.raw)) {
        if (value !== null && value !== undefined && typeof value !== 'object') {
          flat[key] = String(value);
        }
      }
      const res = await this.applyPayoutWebhook({
        withdrawalId: w.id,
        status: info.status,
        rawPayload: flat,
      });
      applied = !res.alreadyProcessed;
    }

    return {
      applied,
      status: info.status,
      providerStatus: info.providerStatus,
      providerId: info.providerId,
      amount: info.amount,
      currency: info.currency,
      commission: info.commission,
      paymentSystem: info.paymentSystem,
      createdAt: info.createdAt,
      updatedAt: info.updatedAt,
    };
  }

  /**
   * Применяет статус выплаты из колбэка провайдера.
   * success → COMPLETED (hold списывается окончательно);
   * cancel → FAILED с возвратом средств на баланс.
   */
  async applyPayoutWebhook(params: {
    withdrawalId: string;
    status: 'COMPLETED' | 'FAILED' | 'PENDING';
    rawPayload: Record<string, string>;
  }): Promise<{ ok: true; alreadyProcessed: boolean }> {
    if (params.status === 'PENDING') return { ok: true, alreadyProcessed: false };

    return this.prisma.$transaction(async (tx) => {
      const w = await tx.withdrawal.findUnique({ where: { id: params.withdrawalId } });
      if (!w) throw new NotFoundException('WITHDRAWAL_NOT_FOUND');
      if (w.status === 'COMPLETED' || w.status === 'REJECTED' || w.status === 'CANCELLED') {
        return { ok: true as const, alreadyProcessed: true };
      }

      if (params.status === 'COMPLETED') {
        const claimed = await tx.withdrawal.updateMany({
          where: { id: w.id, status: { in: ['PENDING', 'PROCESSING'] } },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            rawWebhookPayload: params.rawPayload as Prisma.InputJsonValue,
          },
        });
        if (claimed.count !== 1) return { ok: true as const, alreadyProcessed: true };

        // Hold из PENDING становится окончательным списанием
        const hold = await tx.transaction.findUnique({
          where: { idempotencyKey: `withdrawal:${w.id}:hold` },
        });
        if (hold && hold.status === 'PENDING') {
          await tx.transaction.update({ where: { id: hold.id }, data: { status: 'COMPLETED' } });
        }
        this.logger.log(`Withdrawal ${w.id} COMPLETED по колбэку провайдера`);
        return { ok: true as const, alreadyProcessed: false };
      }

      // Провайдер отменил выплату — возвращаем деньги игроку
      const claimed = await tx.withdrawal.updateMany({
        where: { id: w.id, status: { in: ['PENDING', 'PROCESSING'] } },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          reason: 'Отклонено платёжной системой',
          rawWebhookPayload: params.rawPayload as Prisma.InputJsonValue,
        },
      });
      if (claimed.count !== 1) return { ok: true as const, alreadyProcessed: true };

      const refundKey = `withdrawal:${w.id}:refund`;
      const existing = await tx.transaction.findUnique({ where: { idempotencyKey: refundKey } });
      if (!existing) {
        const user = await tx.user.update({
          where: { id: w.userId },
          data: { balanceMinor: { increment: w.amountMinor } },
          select: { balanceMinor: true },
        });
        await tx.transaction.create({
          data: {
            userId: w.userId,
            type: 'WITHDRAW',
            status: 'REVERSED',
            amountMinor: w.amountMinor,
            balanceAfterMinor: user.balanceMinor,
            idempotencyKey: refundKey,
            referenceType: 'withdrawal',
            referenceId: w.id,
            description: 'Выплата отклонена платёжной системой — возврат',
          },
        });
      }
      this.logger.warn(`Withdrawal ${w.id} FAILED по колбэку провайдера — средства возвращены`);
      return { ok: true as const, alreadyProcessed: false };
    });
  }

  async createWithdrawal(params: {
    userId: string;
    paymentMethodId: string;
    amountMinor: bigint;
    destination: Prisma.InputJsonValue;
  }): Promise<Withdrawal> {
    const { userId, paymentMethodId, amountMinor, destination } = params;

    const pm = await this.methods.getUsable(paymentMethodId, 'WITHDRAWAL');
    const method = this.providerToMethod(pm.provider);

    const globalMin = await this.getMinMinor();
    // Глобальный минимум из настроек — это «пол»: способ вывода не может опустить
    // минимальную сумму ниже значения из настроек (withdrawal.min_amount_minor).
    const minMinor = pm.minAmountMinor > globalMin ? pm.minAmountMinor : globalMin;
    const maxMinor = pm.maxAmountMinor > 0n ? pm.maxAmountMinor : this.maxMinorFallback;
    if (amountMinor < minMinor || amountMinor > maxMinor) {
      throw new BadRequestException(
        `Amount must be between ${minMinor} and ${maxMinor} qəpik`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Резерв средств с проверкой внутри UPDATE: параллельные заявки не смогут
      // зарезервировать один и тот же баланс дважды.
      const balanceAfter = await debitBalance(tx, userId, amountMinor);

      const withdrawal = await tx.withdrawal.create({
        data: {
          userId,
          method,
          paymentMethodId: pm.id,
          amountMinor,
          destination,
          status: 'PENDING',
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'WITHDRAW',
          status: 'PENDING',
          amountMinor: -amountMinor,
          balanceAfterMinor: balanceAfter,
          idempotencyKey: `withdrawal:${withdrawal.id}:hold`,
          referenceType: 'withdrawal',
          referenceId: withdrawal.id,
          description: `Withdrawal hold via ${method}`,
        },
      });

      return withdrawal;
    });
  }

  /**
   * Заявка на вывод + (в режиме auto) немедленная отправка выплаты провайдеру.
   * Ошибка провайдера не отменяет заявку — она просто останется модератору.
   */
  async createAndMaybePayout(params: {
    userId: string;
    paymentMethodId: string;
    amountMinor: bigint;
    destination: Prisma.InputJsonValue;
  }): Promise<Withdrawal> {
    const withdrawal = await this.createWithdrawal(params);

    if ((await this.getAutoMode()) !== 'auto') return withdrawal;

    try {
      const externalId = await this.sendPayout(withdrawal.id);
      if (externalId) {
        return await this.prisma.withdrawal.findUniqueOrThrow({ where: { id: withdrawal.id } });
      }
    } catch (e) {
      this.logger.error(`Автовыплата ${withdrawal.id} не прошла, заявка уходит модератору: ${String(e)}`);
    }
    return withdrawal;
  }

  async listForUser(params: {
    userId: string;
    limit: number;
    cursor?: string | undefined;
  }): Promise<{ items: Withdrawal[]; nextCursor: string | null }> {
    const { userId, limit, cursor } = params;
    const take = Math.min(Math.max(limit, 1), 100);

    const items = await this.prisma.withdrawal.findMany({
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
   * Пользователь отменяет PENDING-заявку. Возврат hold-средств.
   * Идемпотентен: повторный вызов вернёт текущее состояние без побочных эффектов.
   */
  async cancelByUser(params: { userId: string; withdrawalId: string }): Promise<Withdrawal> {
    const { userId, withdrawalId } = params;
    return this.prisma.$transaction(async (tx) => {
      const w = await tx.withdrawal.findUnique({ where: { id: withdrawalId } });
      if (!w || w.userId !== userId) throw new NotFoundException('WITHDRAWAL_NOT_FOUND');
      if (w.status === 'CANCELLED') return w;
      if (w.status !== 'PENDING') {
        throw new ConflictException('WITHDRAWAL_NOT_CANCELLABLE');
      }

      const refundKey = `withdrawal:${w.id}:refund`;
      const existingRefund = await tx.transaction.findUnique({ where: { idempotencyKey: refundKey } });
      if (existingRefund) {
        return tx.withdrawal.update({ where: { id: w.id }, data: { status: 'CANCELLED' } });
      }

      // Переводим статус условно: если модератор параллельно одобрил заявку,
      // count будет 0 и мы не вернём деньги по уже выплаченному выводу.
      const claimed = await tx.withdrawal.updateMany({
        where: { id: w.id, status: 'PENDING' },
        data: { status: 'CANCELLED', completedAt: new Date() },
      });
      if (claimed.count !== 1) throw new ConflictException('WITHDRAWAL_NOT_CANCELLABLE');

      const updated = await tx.user.update({
        where: { id: userId },
        data: { balanceMinor: { increment: w.amountMinor } },
        select: { balanceMinor: true },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'WITHDRAW',
          status: 'REVERSED',
          amountMinor: w.amountMinor,
          balanceAfterMinor: updated.balanceMinor,
          idempotencyKey: refundKey,
          referenceType: 'withdrawal',
          referenceId: w.id,
          description: 'Withdrawal cancelled — refund',
        },
      });

      return tx.withdrawal.findUniqueOrThrow({ where: { id: w.id } });
    });
  }
}
