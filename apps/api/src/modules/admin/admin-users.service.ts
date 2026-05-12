import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import type { User, UserStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.module';
import { AdminAuditService } from './admin-audit.service';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  async list(params: { search?: string; limit: number; cursor?: string }) {
    const take = Math.min(Math.max(params.limit, 1), 100);
    const q = params.search?.trim();
    const where = q
      ? {
          OR: [
            { username: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
            { phone: { contains: q } },
            { id: q },
          ],
        }
      : {};
    const items = await this.prisma.user.findMany({
      where,
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

  async getById(id: string): Promise<User> {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('USER_NOT_FOUND');
    return u;
  }

  async adjustBalance(params: {
    actorId: string;
    userId: string;
    amountMinor: bigint;
    reason: string;
    ip?: string;
    userAgent?: string;
  }): Promise<User> {
    const { actorId, userId, amountMinor, reason } = params;
    if (amountMinor === 0n) throw new BadRequestException('AMOUNT_ZERO');

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, balanceMinor: true },
      });
      if (!user) throw new NotFoundException('USER_NOT_FOUND');
      const next = user.balanceMinor + amountMinor;
      if (next < 0n) throw new ConflictException('INSUFFICIENT_FUNDS');

      const updated = await tx.user.update({
        where: { id: userId },
        data: { balanceMinor: next },
      });

      const txRow = await tx.transaction.create({
        data: {
          userId,
          type: 'ADMIN_ADJUSTMENT',
          status: 'COMPLETED',
          amountMinor,
          balanceAfterMinor: next,
          description: reason.slice(0, 200),
          referenceType: 'admin_adjust',
          referenceId: actorId,
        },
      });

      await this.audit.log({
        actorId,
        action: 'wallet.adjust',
        entityType: 'user',
        entityId: userId,
        payload: {
          amountMinor: amountMinor.toString(),
          reason,
          transactionId: txRow.id,
        },
        ip: params.ip,
        userAgent: params.userAgent,
        tx,
      });

      return updated;
    });
  }

  async setStatus(params: {
    actorId: string;
    userId: string;
    status: UserStatus;
    reason?: string;
    ip?: string;
    userAgent?: string;
  }): Promise<User> {
    const updated = await this.prisma.user.update({
      where: { id: params.userId },
      data: { status: params.status },
    });
    await this.audit.log({
      actorId: params.actorId,
      action: 'user.status',
      entityType: 'user',
      entityId: params.userId,
      payload: { status: params.status, reason: params.reason ?? null },
      ip: params.ip,
      userAgent: params.userAgent,
    });
    return updated;
  }
}
