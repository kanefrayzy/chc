import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const createCodePurchaseSchema = z.object({
  amountMinor: z.string().regex(/^\d+$/, 'amountMinor must be integer string'),
  comment: z.string().max(500).optional(),
});
export class CreateCodePurchaseDto extends createZodDto(createCodePurchaseSchema) {}
