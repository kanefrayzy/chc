import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const createDepositSchema = z.object({
  paymentMethodId: z.string().min(1),
  amountMinor: z
    .string()
    .max(19, 'amountMinor is too large')
    .regex(/^\d+$/, 'amountMinor must be a non-negative integer string'),
});

export class CreateDepositDto extends createZodDto(createDepositSchema) {}
