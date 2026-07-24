import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import type { Prisma, Withdrawal, WithdrawalMethod, PaymentProvider as PaymentProviderEnum } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.module';
import { PaymentMethodsService } from '../payment-methods/payment-methods.service';
import { SettingsService } from '../settings/settings.service';

const DEFAULT_MAX_MINOR = 1_000_000n; // 10 000 AZN (страховочный потолок)

@Injectable()
export class WithdrawalsService {
  private readonly logger = new Logger(WithdrawalsService.name);
  private readonly maxMinorFallback: bigint;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly methods: PaymentMethodsService,
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
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { balanceMinor: true },
      });
      if (!user) throw new NotFoundException('USER_NOT_FOUND');
      if (user.balanceMinor < amountMinor) {
        throw new ConflictException('INSUFFICIENT_FUNDS');
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: { balanceMinor: { decrement: amountMinor } },
        select: { balanceMinor: true },
      });

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
          balanceAfterMinor: updated.balanceMinor,
          idempotencyKey: `withdrawal:${withdrawal.id}:hold`,
          referenceType: 'withdrawal',
          referenceId: withdrawal.id,
          description: `Withdrawal hold via ${method}`,
        },
      });

      return withdrawal;
    });
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

      return tx.withdrawal.update({
        where: { id: w.id },
        data: { status: 'CANCELLED', completedAt: new Date() },
      });
    });
  }
}
