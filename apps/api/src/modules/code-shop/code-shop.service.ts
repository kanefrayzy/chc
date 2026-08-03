import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.module';
import { debitBalance } from '../../common/balance';
import { RealtimeGateway } from '../realtime/realtime.gateway';

/** Сколько раз пробуем занять код, если его перехватил параллельный покупатель. */
const CLAIM_ATTEMPTS = 3;

@Injectable()
export class CodeShopService {
  private readonly logger = new Logger(CodeShopService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  // ── витрина ─────────────────────────────────────────────────────────

  /** Активные номиналы с остатком на складе. */
  async listProducts() {
    const products = await this.prisma.codeProduct.findMany({
      where: { enabled: true },
      orderBy: [{ displayOrder: 'asc' }, { denominationMinor: 'asc' }],
    });
    const stock = await this.stockByProduct(products.map((p) => p.id));
    return products.map((p) => ({ ...p, stock: stock.get(p.id) ?? 0 }));
  }

  /** Все номиналы + остатки и продажи — для админки. */
  async listProductsAdmin() {
    const products = await this.prisma.codeProduct.findMany({
      orderBy: [{ displayOrder: 'asc' }, { denominationMinor: 'asc' }],
    });
    const ids = products.map((p) => p.id);
    const [stock, sold] = await Promise.all([
      this.stockByProduct(ids),
      this.prisma.codeItem.groupBy({
        by: ['productId'],
        where: { productId: { in: ids }, status: 'SOLD' },
        _count: { _all: true },
      }),
    ]);
    const soldMap = new Map(sold.map((s) => [s.productId, s._count._all]));
    return products.map((p) => ({
      ...p,
      stock: stock.get(p.id) ?? 0,
      soldCount: soldMap.get(p.id) ?? 0,
    }));
  }

  private async stockByProduct(ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.codeItem.groupBy({
      by: ['productId'],
      where: { productId: { in: ids }, status: 'AVAILABLE' },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.productId, r._count._all]));
  }

  // ── покупка ─────────────────────────────────────────────────────────

  /**
   * Моментальная покупка: списываем цену с баланса и отдаём код из склада.
   * Код занимается условным апдейтом (`status: AVAILABLE` в WHERE), поэтому
   * два одновременных покупателя не могут получить один и тот же код.
   */
  async buy(params: { userId: string; productId: string }) {
    const { userId, productId } = params;

    for (let attempt = 1; attempt <= CLAIM_ATTEMPTS; attempt += 1) {
      try {
        return await this.buyOnce(userId, productId);
      } catch (e) {
        if (e instanceof ConflictException && e.message === 'CODE_TAKEN' && attempt < CLAIM_ATTEMPTS) {
          continue;
        }
        throw e;
      }
    }
    throw new ConflictException('CODE_TAKEN');
  }

  private async buyOnce(userId: string, productId: string) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.codeProduct.findUnique({ where: { id: productId } });
      if (!product) throw new NotFoundException('PRODUCT_NOT_FOUND');
      if (!product.enabled) throw new BadRequestException('PRODUCT_DISABLED');
      if (product.priceMinor <= 0n) throw new BadRequestException('PRODUCT_PRICE_INVALID');

      const candidate = await tx.codeItem.findFirst({
        where: { productId, status: 'AVAILABLE' },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (!candidate) throw new ConflictException('OUT_OF_STOCK');

      // Списание с проверкой средств внутри UPDATE (ADR-0009)
      const balanceAfter = await debitBalance(tx, userId, product.priceMinor);

      const claimed = await tx.codeItem.updateMany({
        where: { id: candidate.id, status: 'AVAILABLE' },
        data: {
          status: 'SOLD',
          soldToId: userId,
          soldAt: new Date(),
          priceMinor: product.priceMinor,
        },
      });
      // Код увели из параллельной покупки — откатываем всю транзакцию и пробуем снова
      if (claimed.count !== 1) throw new ConflictException('CODE_TAKEN');

      const item = await tx.codeItem.findUniqueOrThrow({ where: { id: candidate.id } });

      await tx.transaction.create({
        data: {
          userId,
          type: 'CODE_SHOP_BUY',
          status: 'COMPLETED',
          amountMinor: -product.priceMinor,
          balanceAfterMinor: balanceAfter,
          idempotencyKey: `code-shop:${item.id}`,
          referenceType: 'code_item',
          referenceId: item.id,
          description: `Покупка кода «${product.name}»`,
        },
      });

      this.logger.log(`Код ${item.id} (${product.name}) продан ${userId} за ${product.priceMinor}`);

      this.realtime.emitToUser(userId, 'wallet:balance', {
        balanceMinor: balanceAfter.toString(),
      });

      return { item, product, balanceMinor: balanceAfter };
    });
  }

  /** История покупок игрока. */
  async history(params: { userId: string; limit: number; cursor?: string }) {
    const { userId, limit, cursor } = params;
    const take = Math.min(Math.max(limit, 1), 50);
    const items = await this.prisma.codeItem.findMany({
      where: { soldToId: userId, status: 'SOLD' },
      orderBy: { soldAt: 'desc' },
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: { product: true },
    });
    let nextCursor: string | null = null;
    if (items.length > take) {
      const next = items.pop();
      nextCursor = next?.id ?? null;
    }
    return { items, nextCursor };
  }

  // ── админка ─────────────────────────────────────────────────────────

  async createProduct(data: {
    name: string;
    denominationMinor: bigint;
    priceMinor: bigint;
    description?: string;
    displayOrder?: number;
    enabled?: boolean;
  }) {
    return this.prisma.codeProduct.create({
      data: {
        name: data.name,
        denominationMinor: data.denominationMinor,
        priceMinor: data.priceMinor,
        description: data.description ?? null,
        displayOrder: data.displayOrder ?? 0,
        enabled: data.enabled ?? true,
      },
    });
  }

  async updateProduct(
    id: string,
    data: {
      name?: string;
      denominationMinor?: bigint;
      priceMinor?: bigint;
      description?: string | null;
      displayOrder?: number;
      enabled?: boolean;
    },
  ) {
    const patch: Prisma.CodeProductUpdateInput = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.denominationMinor !== undefined) patch.denominationMinor = data.denominationMinor;
    if (data.priceMinor !== undefined) patch.priceMinor = data.priceMinor;
    if (data.description !== undefined) patch.description = data.description;
    if (data.displayOrder !== undefined) patch.displayOrder = data.displayOrder;
    if (data.enabled !== undefined) patch.enabled = data.enabled;
    return this.prisma.codeProduct.update({ where: { id }, data: patch });
  }

  /** Удалять можно только номинал без единой продажи — иначе теряется история. */
  async deleteProduct(id: string): Promise<void> {
    const sold = await this.prisma.codeItem.count({ where: { productId: id, status: 'SOLD' } });
    if (sold > 0) throw new ConflictException('PRODUCT_HAS_SALES');
    await this.prisma.codeProduct.delete({ where: { id } });
  }

  /**
   * Заливка кодов пачкой. Дубликаты внутри номинала игнорируются, поэтому
   * повторная вставка того же списка ничего не ломает.
   */
  async addCodes(productId: string, raw: string): Promise<{ added: number; skipped: number }> {
    const product = await this.prisma.codeProduct.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('PRODUCT_NOT_FOUND');

    const codes = [
      ...new Set(
        raw
          .split(/[\r\n,;\s]+/)
          .map((c) => c.trim())
          .filter((c) => c.length > 0)
          .map((c) => c.slice(0, 128)),
      ),
    ];
    if (codes.length === 0) throw new BadRequestException('NO_CODES');

    const result = await this.prisma.codeItem.createMany({
      data: codes.map((code) => ({ productId, code })),
      skipDuplicates: true,
    });
    return { added: result.count, skipped: codes.length - result.count };
  }

  /** Непроданные коды номинала — чтобы админ видел, что лежит на складе. */
  async listItems(productId: string, status?: 'AVAILABLE' | 'SOLD' | 'DISABLED') {
    return this.prisma.codeItem.findMany({
      where: { productId, ...(status ? { status } : {}) },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      take: 500,
      include: { soldTo: { select: { username: true } } },
    });
  }

  async deleteItem(id: string): Promise<void> {
    const item = await this.prisma.codeItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('CODE_NOT_FOUND');
    if (item.status === 'SOLD') throw new ConflictException('CODE_ALREADY_SOLD');
    await this.prisma.codeItem.delete({ where: { id } });
  }

  /** Все продажи — лента для админки. */
  async listSales(params: { limit: number; cursor?: string }) {
    const take = Math.min(Math.max(params.limit, 1), 100);
    const items = await this.prisma.codeItem.findMany({
      where: { status: 'SOLD' },
      orderBy: { soldAt: 'desc' },
      take: take + 1,
      ...(params.cursor ? { skip: 1, cursor: { id: params.cursor } } : {}),
      include: { product: true, soldTo: { select: { username: true } } },
    });
    let nextCursor: string | null = null;
    if (items.length > take) {
      const next = items.pop();
      nextCursor = next?.id ?? null;
    }
    return { items, nextCursor };
  }
}
