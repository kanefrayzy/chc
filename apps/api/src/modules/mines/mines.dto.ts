import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { MINES_MAX_MINES, MINES_MIN_MINES, MINES_TOTAL_TILES } from './mines.constants';

export const startMinesSchema = z.object({
  amountMinor: z
    .string()
    .regex(/^\d+$/, 'amountMinor must be a positive integer string')
    .refine((v) => BigInt(v) > 0n, 'amountMinor must be > 0'),
  mineCount: z.number().int().min(MINES_MIN_MINES).max(MINES_MAX_MINES),
  clientSeed: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, 'clientSeed must contain only [A-Za-z0-9_-]')
    .optional(),
});

export class StartMinesDto extends createZodDto(startMinesSchema) {}

export const revealMinesSchema = z.object({
  tile: z.number().int().min(0).max(MINES_TOTAL_TILES - 1),
});

export class RevealMinesDto extends createZodDto(revealMinesSchema) {}
