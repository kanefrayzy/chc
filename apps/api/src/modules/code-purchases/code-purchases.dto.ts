import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const createCodePurchaseSchema = z.object({
  comment: z.string().max(500).optional(),
});
export class CreateCodePurchaseDto extends createZodDto(createCodePurchaseSchema) {}
