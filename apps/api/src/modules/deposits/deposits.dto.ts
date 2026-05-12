import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const createDepositSchema = z.object({
  provider: z.enum(['BETRA_H2H', 'WESTWALLET']),
  amountMinor: z
    .string()
    .regex(/^\d+$/, 'amountMinor must be a non-negative integer string'),
});

export class CreateDepositDto extends createZodDto(createDepositSchema) {}
