import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const placeBetSchema = z.object({
  color: z.enum(['BLACK', 'RED', 'GREEN']),
  amountMinor: z
    .string()
    .max(19, 'amountMinor is too large')
    .regex(/^\d+$/, 'amountMinor must be a positive integer string')
    .refine((v) => BigInt(v) > 0n, 'amountMinor must be > 0'),
});

export class PlaceBetDto extends createZodDto(placeBetSchema) {}
