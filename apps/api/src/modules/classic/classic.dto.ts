import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

/**
 * Валидация через Zod: глобальный пайп приложения — ZodValidationPipe,
 * декораторы class-validator он не исполняет (тело доходило бы до BigInt() сырым).
 */
export const placeClassicBetSchema = z.object({
  /** Сумма ставки в qəpik (строкой — BigInt не переживает JSON). */
  amountMinor: z
    .string()
    .regex(/^[1-9]\d{0,18}$/, 'amountMinor must be a positive integer string'),
});

export class PlaceClassicBetDto extends createZodDto(placeClassicBetSchema) {}
