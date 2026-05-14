import { Injectable, NotFoundException } from '@nestjs/common';
import type { PaymentMethod, PaymentMethodKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.module';
import type {
  CreatePaymentMethodDto,
  UpdatePaymentMethodDto,
} from './payment-methods.dto';

@Injectable()
export class PaymentMethodsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Активные методы для пользователя, отфильтрованные по kind. */
  async listPublic(kind: 'DEPOSIT' | 'WITHDRAWAL'): Promise<PaymentMethod[]> {
    return this.prisma.paymentMethod.findMany({
      where: {
        enabled: true,
        OR: [{ kind }, { kind: 'BOTH' }],
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /** Все методы (для админки). */
  async listAll(): Promise<PaymentMethod[]> {
    return this.prisma.paymentMethod.findMany({
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async getById(id: string): Promise<PaymentMethod> {
    const m = await this.prisma.paymentMethod.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Payment method not found');
    return m;
  }

  /** Возвращает метод, готовый к использованию (enabled). Бросает 404 иначе. */
  async getUsable(id: string, kind: PaymentMethodKind): Promise<PaymentMethod> {
    const m = await this.getById(id);
    if (!m.enabled) throw new NotFoundException('Payment method disabled');
    if (m.kind !== 'BOTH' && m.kind !== kind) {
      throw new NotFoundException(`Method does not support ${kind.toLowerCase()}`);
    }
    return m;
  }

  async create(dto: CreatePaymentMethodDto): Promise<PaymentMethod> {
    return this.prisma.paymentMethod.create({
      data: {
        name: dto.name,
        provider: dto.provider,
        kind: dto.kind,
        currency: dto.currency,
        description: dto.description ?? null,
        minAmountMinor: dto.minAmountMinor,
        maxAmountMinor: dto.maxAmountMinor,
        displayOrder: dto.displayOrder,
        enabled: dto.enabled,
        config: (dto.config ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async update(id: string, dto: UpdatePaymentMethodDto): Promise<PaymentMethod> {
    await this.getById(id);
    const data: Prisma.PaymentMethodUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.provider !== undefined) data.provider = dto.provider;
    if (dto.kind !== undefined) data.kind = dto.kind;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.description !== undefined) data.description = dto.description ?? null;
    if (dto.minAmountMinor !== undefined) data.minAmountMinor = dto.minAmountMinor;
    if (dto.maxAmountMinor !== undefined) data.maxAmountMinor = dto.maxAmountMinor;
    if (dto.displayOrder !== undefined) data.displayOrder = dto.displayOrder;
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.config !== undefined) data.config = dto.config as Prisma.InputJsonValue;

    return this.prisma.paymentMethod.update({ where: { id }, data });
  }

  async setIcon(id: string, iconUrl: string): Promise<PaymentMethod> {
    await this.getById(id);
    return this.prisma.paymentMethod.update({ where: { id }, data: { iconUrl } });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.paymentMethod.delete({ where: { id } });
  }
}
