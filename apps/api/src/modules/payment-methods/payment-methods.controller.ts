import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentMethodsService } from './payment-methods.service';
import {
  toPublicPaymentMethod,
  type PublicPaymentMethodDto,
} from './payment-methods.mapper';

const KindSchema = z.enum(['DEPOSIT', 'WITHDRAWAL']);

@Controller('payment-methods')
@UseGuards(JwtAuthGuard)
export class PaymentMethodsController {
  constructor(private readonly service: PaymentMethodsService) {}

  /** GET /payment-methods?kind=DEPOSIT — список активных методов для модалок. */
  @Get()
  async list(@Query('kind') kindRaw?: string): Promise<{ items: PublicPaymentMethodDto[] }> {
    const kind = KindSchema.parse(kindRaw ?? 'DEPOSIT');
    const items = await this.service.listPublic(kind);
    return { items: items.map(toPublicPaymentMethod) };
  }
}
