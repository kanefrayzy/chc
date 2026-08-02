import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.module';
import { AdminAuditService } from './admin-audit.service';
import { WithdrawalsService } from '../withdrawals/withdrawals.service';
import { BetatransferPayoutError } from '../payments/betatransfer.provider';

@Injectable()
export class AdminWithdrawalsService {
  private readonly logger = new Logger(AdminWithdrawalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
    private readonly withdrawals: WithdrawalsService,
  ) {}

  async list(params: { status?: string; limit: number; cursor?: string }) {
    const take = Math.min(Math.max(params.limit, 1), 100);
    const where = params.status ? { status: params.status as never } : {};
    const items = await this.prisma.withdrawal.findMany({
      where,
      include: { user: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });
    let nextCursor: string | null = null;
    if (items.length > take) {
      const next = items.pop();
      nextCursor = next?.id ?? null;
    }
    return { items, nextCursor };
  }

  /** Запрашивает статус выплаты у Betatransfer и применяет его, если он финальный. */
  async syncPayoutStatus(withdrawalId: string) {
    try {
      return await this.withdrawals.syncPayoutStatus(withdrawalId);
    } catch (e) {
      if (e instanceof BetatransferPayoutError) throw new ConflictException(e.reason);
      throw e;
    }
  }

  async approve(params: {
    actorId: string;
    withdrawalId: string;
    externalId?: string;
    note?: string;
    ip?: string;
    userAgent?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const w = await tx.withdrawal.findUnique({ where: { id: params.withdrawalId } });
      if (!w) throw new NotFoundException('WITHDRAWAL_NOT_FOUND');
      if (w.status === 'COMPLETED') return w;
      if (w.status !== 'PENDING' && w.status !== 'PROCESSING') {
        throw new ConflictException('WITHDRAWAL_NOT_APPROVABLE');
      }

      // Полуавтомат/автомат: по «Одобрить» выплату отправляет система, а
      // заявка закрывается уже колбэком провайдера. Ручной режим — как раньше:
      // модератор платит сам и просто фиксирует факт выплаты.
      const mode = await this.withdrawals.getAutoMode();
      if ((mode === 'semi' || mode === 'auto') && w.method === 'AUTO_BETATRANSFER') {
        const externalId = await this.withdrawals.sendPayout(w.id).catch((e: unknown) => {
          this.logger.error(`Выплата ${w.id} не отправлена провайдеру: ${String(e)}`);
          // Модератору показываем причину отказа, а не безликий код ошибки.
          throw new ConflictException(
            e instanceof BetatransferPayoutError ? e.reason : 'PAYOUT_PROVIDER_ERROR',
          );
        });
        if (externalId) {
          await this.audit.log({
            actorId: params.actorId,
            action: 'withdrawal.payout_sent',
            entityType: 'withdrawal',
            entityId: w.id,
            payload: { amountMinor: w.amountMinor.toString(), externalId },
            ip: params.ip,
            userAgent: params.userAgent,
            tx,
          });
          return tx.withdrawal.findUniqueOrThrow({
            where: { id: w.id },
            include: { user: { select: { username: true } } },
          });
        }
        // Сумма выше порога или нет реквизитов карты — закрываем вручную
      }

      // Захватываем заявку условно: если пользователь параллельно отменил её
      // (и получил возврат), count будет 0 — выплату не подтверждаем.
      const claimed = await tx.withdrawal.updateMany({
        where: { id: w.id, status: { in: ['PENDING', 'PROCESSING'] } },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          processedByModeratorId: params.actorId,
          externalId: params.externalId ?? w.externalId,
        },
      });
      if (claimed.count !== 1) throw new ConflictException('WITHDRAWAL_NOT_APPROVABLE');

      // Финализируем hold: была PENDING, теперь COMPLETED.
      const holdKey = `withdrawal:${w.id}:hold`;
      const hold = await tx.transaction.findUnique({ where: { idempotencyKey: holdKey } });
      if (hold && hold.status === 'PENDING') {
        await tx.transaction.update({
          where: { id: hold.id },
          data: { status: 'COMPLETED' },
        });
      }

      const updated = await tx.withdrawal.findUniqueOrThrow({
        where: { id: w.id },
        include: { user: { select: { username: true } } },
      });

      await this.audit.log({
        actorId: params.actorId,
        action: 'withdrawal.approve',
        entityType: 'withdrawal',
        entityId: w.id,
        payload: {
          amountMinor: w.amountMinor.toString(),
          externalId: params.externalId ?? null,
          note: params.note ?? null,
        },
        ip: params.ip,
        userAgent: params.userAgent,
        tx,
      });

      return updated;
    });
  }

  async reject(params: {
    actorId: string;
    withdrawalId: string;
    reason: string;
    ip?: string;
    userAgent?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const w = await tx.withdrawal.findUnique({ where: { id: params.withdrawalId } });
      if (!w) throw new NotFoundException('WITHDRAWAL_NOT_FOUND');
      if (w.status === 'REJECTED' || w.status === 'CANCELLED') return w;
      if (w.status === 'COMPLETED') throw new ConflictException('WITHDRAWAL_NOT_REJECTABLE');

      // Условный переход статуса: не возвращаем деньги по заявке,
      // которую параллельно одобрили или уже отменил пользователь.
      const claimed = await tx.withdrawal.updateMany({
        where: { id: w.id, status: { in: ['PENDING', 'PROCESSING'] } },
        data: {
          status: 'REJECTED',
          reason: params.reason.slice(0, 500),
          completedAt: new Date(),
          processedByModeratorId: params.actorId,
        },
      });
      if (claimed.count !== 1) throw new ConflictException('WITHDRAWAL_NOT_REJECTABLE');

      const refundKey = `withdrawal:${w.id}:refund`;
      const existing = await tx.transaction.findUnique({ where: { idempotencyKey: refundKey } });
      if (!existing) {
        const updatedUser = await tx.user.update({
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
            balanceAfterMinor: updatedUser.balanceMinor,
            idempotencyKey: refundKey,
            referenceType: 'withdrawal',
            referenceId: w.id,
            description: `Withdrawal rejected: ${params.reason.slice(0, 100)}`,
          },
        });
      }

      const updated = await tx.withdrawal.findUniqueOrThrow({
        where: { id: w.id },
        include: { user: { select: { username: true } } },
      });

      await this.audit.log({
        actorId: params.actorId,
        action: 'withdrawal.reject',
        entityType: 'withdrawal',
        entityId: w.id,
        payload: { reason: params.reason },
        ip: params.ip,
        userAgent: params.userAgent,
        tx,
      });

      return updated;
    });
  }
}
