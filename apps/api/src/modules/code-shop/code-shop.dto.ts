import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const buyCodeSchema = z.object({
  productId: z.string().min(1),
});
export class BuyCodeDto extends createZodDto(buyCodeSchema) {}

/** Суммы приходят строкой в минорных единицах — как и везде по API. */
const minorString = z
  .string()
  .regex(/^\d+$/, 'Ожидается сумма в qəpik')
  .refine((v) => BigInt(v) >= 0n);

export const createCodeProductSchema = z.object({
  name: z.string().min(1).max(80),
  denominationMinor: minorString,
  priceMinor: minorString,
  description: z.string().max(300).optional(),
  displayOrder: z.number().int().min(0).max(999).optional(),
  enabled: z.boolean().optional(),
});
export class CreateCodeProductDto extends createZodDto(createCodeProductSchema) {}

export const updateCodeProductSchema = createCodeProductSchema.partial().extend({
  description: z.string().max(300).nullable().optional(),
});
export class UpdateCodeProductDto extends createZodDto(updateCodeProductSchema) {}

export const addCodesSchema = z.object({
  codes: z.string().min(1).max(200_000),
});
export class AddCodesDto extends createZodDto(addCodesSchema) {}
