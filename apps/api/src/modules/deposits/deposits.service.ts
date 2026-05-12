import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import type { Deposit, PaymentProvider as PaymentProviderEnum, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.module';
import { PaymentProviderRegistry } from '../payments/payments.module';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class DepositsService {
  private readonly logger = new Logger(DepositsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: PaymentProviderRegistry,
    private readonly settings: SettingsService,
  ) {}

  private async getLimits(): Promise<{ minMinor: bigint; maxMinor: bigint }> {
    const [minStr, maxStr] = await Promise.all([
      this.settings.get<string>('deposit.min_amount_minor'),
      this.settings.get<string>('deposit.max_amount_minor'),
    ]);
    return { minMinor: BigInt(minStr), maxMinor: BigInt(maxStr) };
  }

  async createDeposit(params: {
    userId: string;
    provider: PaymentProviderEnum;
    amountMinor: bigint;
  }): Promise<Deposit> {
    const { userId, provider, amountMinor } = params;
    const { minMinor, maxMinor } = await this.getLimits();
    if (amountMinor < minMinor || amountMinor > maxMinor) {
      throw new BadRequestException(
        `Amount must be between ${minMinor} and ${maxMinor} qəpik`,
      );
    }

    const provImpl = this.providers.get(provider);

    // создаём запись со статусом PENDING, чтобы получить depositId
    const draft = await this.prisma.deposit.create({
      data: { userId, provider, amountMinor, status: 'PENDING' },
    });

    try {
      const result = await provImpl.createDeposit({
        depositId: draft.id,
        userId,
        amountMinor,
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

    // COMPLETED → атомарно: deposit + transaction + balance
    const idempotencyKey = `deposit:${deposit.id}`;
    await this.prisma.$transaction(async (tx) => {
      const existingTx = await tx.transaction.findUnique({ where: { idempotencyKey } });
      if (existingTx) return; // защита от двойного применения

      const updatedUser = await tx.user.update({
        where: { id: deposit.userId },
        data: { balanceMinor: { increment: deposit.amountMinor } },
        select: { balanceMinor: true },
      });

      await tx.transaction.create({
        data: {
          userId: deposit.userId,
          type: 'DEPOSIT',
          status: 'COMPLETED',
          amountMinor: deposit.amountMinor,
          balanceAfterMinor: updatedUser.balanceMinor,
          idempotencyKey,
          referenceType: 'deposit',
          referenceId: deposit.id,
          description: `Deposit via ${deposit.provider}`,
        },
      });

      await tx.deposit.update({
        where: { id: deposit.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          rawWebhookPayload: params.rawPayload as Prisma.InputJsonValue,
        },
      });
    });

    this.logger.log(`Deposit ${deposit.id} COMPLETED via ${deposit.provider}`);
    return { ok: true, alreadyProcessed: false };
  }
}
