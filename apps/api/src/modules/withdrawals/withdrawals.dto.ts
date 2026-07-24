import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

/**
 * Destinations:
 *  - AUTO_BETATRANSFER → { cardNumber: "**** **** **** 1234", cardHolder? }
 *  - AUTO_WESTWALLET → { walletAddress: TRC20 string, network: "TRC20" }
 *  - MANUAL_MODERATOR → произвольное описание (поле details)
 */
const cardDestination = z.object({
  kind: z.literal('card'),
  cardNumber: z.string().min(8).max(32),
  cardHolder: z.string().min(2).max(64).optional(),
});

const cryptoDestination = z.object({
  kind: z.literal('crypto'),
  walletAddress: z.string().min(20).max(128),
  network: z.literal('TRC20').default('TRC20'),
});

const manualDestination = z.object({
  kind: z.literal('manual'),
  details: z.string().min(2).max(500),
});

export const createWithdrawalSchema = z.object({
  paymentMethodId: z.string().min(1),
  amountMinor: z
    .string()
    .regex(/^\d+$/, 'amountMinor must be a non-negative integer string'),
  destination: z.discriminatedUnion('kind', [
    cardDestination,
    cryptoDestination,
    manualDestination,
  ]),
});

export class CreateWithdrawalDto extends createZodDto(createWithdrawalSchema) {}
