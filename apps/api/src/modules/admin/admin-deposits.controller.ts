import {
  Controller,
  Get,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { minorToJson } from '@chcgreen/shared';
import { PrismaService } from '../../common/prisma/prisma.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

/** Достаёт строковое поле из JSON-колонки, не роняя запрос на кривых данных. */
function jsonString(raw: unknown, key: string): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = (raw as Record<string, unknown>)[key];
  return value === null || value === undefined ? null : String(value);
}

@Controller('admin/deposits')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MODERATOR', 'SUPER_ADMIN')
export class AdminDepositsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Лента пополнений: статус, сумма, выданные h2h-реквизиты и номер заказа
   * на стороне провайдера — по нему платёж ищется в панели Betatransfer.
   */
  @Get()
  async list(
    @Query('status') status: string | undefined,
    @Query('provider') provider: string | undefined,
    @Query('search') search: string | undefined,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('cursor') cursor?: string,
  ) {
    const take = Math.min(Math.max(limit, 1), 100);

    const where: Prisma.DepositWhereInput = {};
    if (status) where.status = status as Prisma.DepositWhereInput['status'];
    if (provider) where.provider = provider as Prisma.DepositWhereInput['provider'];
    if (search?.trim()) {
      const term = search.trim();
      where.OR = [
        { id: { contains: term, mode: 'insensitive' } },
        { externalId: { contains: term, mode: 'insensitive' } },
        { externalAddress: { contains: term, mode: 'insensitive' } },
        { user: { username: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const rows = await this.prisma.deposit.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        user: { select: { username: true } },
        paymentMethod: { select: { name: true } },
      },
    });

    let nextCursor: string | null = null;
    if (rows.length > take) {
      const next = rows.pop();
      nextCursor = next?.id ?? null;
    }

    return {
      items: rows.map((d) => ({
        id: d.id,
        username: d.user?.username ?? null,
        methodName: d.paymentMethod?.name ?? null,
        provider: d.provider,
        status: d.status,
        amountMinor: minorToJson(d.amountMinor),
        originalAmount: d.originalAmount,
        originalCurrency: d.originalCurrency,
        // Номер заказа у провайдера: при создании кладём в requisiteDetails,
        // в колбэке он приходит как `id`.
        providerId:
          jsonString(d.requisiteDetails, 'providerId') ??
          jsonString(d.rawWebhookPayload, 'id'),
        requisite: d.externalAddress,
        requisiteBank: jsonString(d.requisiteDetails, 'bank'),
        requisiteOwner: jsonString(d.requisiteDetails, 'owner'),
        paymentUrl: d.paymentUrl,
        createdAt: d.createdAt.toISOString(),
        completedAt: d.completedAt ? d.completedAt.toISOString() : null,
        expiresAt: d.expiresAt ? d.expiresAt.toISOString() : null,
      })),
      nextCursor,
    };
  }

  /** Счётчики по статусам — для вкладок. */
  @Get('stats')
  async stats() {
    const grouped = await this.prisma.deposit.groupBy({
      by: ['status'],
      _count: { _all: true },
      _sum: { amountMinor: true },
    });
    return {
      items: grouped.map((g) => ({
        status: g.status,
        count: g._count._all,
        totalMinor: minorToJson(g._sum.amountMinor ?? 0n),
      })),
    };
  }
}
