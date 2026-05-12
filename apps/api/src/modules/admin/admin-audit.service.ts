import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.module';

@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    actorId: string;
    action: string;
    entityType?: string;
    entityId?: string;
    payload?: Prisma.InputJsonValue;
    ip?: string;
    userAgent?: string;
    tx?: Prisma.TransactionClient;
  }): Promise<void> {
    const client = params.tx ?? this.prisma;
    await client.auditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        ...(params.payload !== undefined ? { payload: params.payload } : {}),
        ip: params.ip ?? null,
        userAgent: params.userAgent ?? null,
      },
    });
  }

  async list(params: { limit: number; cursor?: string }) {
    const take = Math.min(Math.max(params.limit, 1), 100);
    const items = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      include: { actor: { select: { id: true, username: true, role: true } } },
    });
    let nextCursor: string | null = null;
    if (items.length > take) {
      const next = items.pop();
      nextCursor = next?.id ?? null;
    }
    return { items, nextCursor };
  }
}
