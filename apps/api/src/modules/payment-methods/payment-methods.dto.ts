import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const PaymentProviderEnumSchema = z.enum(['BETRA_H2H', 'WESTWALLET']);
export const PaymentMethodKindSchema = z.enum(['DEPOSIT', 'WITHDRAWAL', 'BOTH']);

/**
 * Провайдер-специфичный конфиг метода.
 *
 * BETRA_H2H:
 *  - aggregators: массив приоритетов агрегаторов Betra (jupiter/gtxpay/...).
 *  - betraCurrency: код валюты Betra (AZN/RUB/KZT/UZS/TJS/KGS/USDT) — не путать
 *    с пользовательской `currency` (отображаемой). Обычно совпадает.
 *
 * WESTWALLET:
 *  - ticker: тикер WestWallet (BTC, USDTTRC, ETH, ...).
 *  - dest_tag_required: нужен ли destination_tag.
 */
export const PaymentMethodConfigSchema = z
  .object({
    aggregators: z.array(z.string()).optional(),
    betraCurrency: z.string().optional(),
    ticker: z.string().optional(),
    dest_tag_required: z.boolean().optional(),
  })
  .strict();

export type PaymentMethodConfig = z.infer<typeof PaymentMethodConfigSchema>;

const baseFields = {
  name: z.string().trim().min(1).max(60),
  provider: PaymentProviderEnumSchema,
  kind: PaymentMethodKindSchema,
  currency: z.string().trim().min(2).max(10),
  description: z.string().trim().max(500).optional().nullable(),
  minAmountMinor: z.coerce.bigint().nonnegative(),
  maxAmountMinor: z.coerce.bigint().nonnegative(),
  displayOrder: z.coerce.number().int().min(0).max(10_000),
  enabled: z.boolean(),
  config: PaymentMethodConfigSchema.default({}),
} as const;

export const CreatePaymentMethodSchema = z.object(baseFields);
export class CreatePaymentMethodDto extends createZodDto(CreatePaymentMethodSchema) {}

export const UpdatePaymentMethodSchema = z.object(baseFields).partial();
export class UpdatePaymentMethodDto extends createZodDto(UpdatePaymentMethodSchema) {}
