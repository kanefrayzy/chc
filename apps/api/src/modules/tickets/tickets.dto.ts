import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const sendMessageSchema = z.object({
  body: z.string().min(1).max(4000),
});
export class SendMessageDto extends createZodDto(sendMessageSchema) {}

export const createTicketSchema = z.object({
  type: z.enum(['CODE_PURCHASE', 'WITHDRAWAL', 'SUPPORT']).default('SUPPORT'),
  subject: z.string().min(1).max(300).optional(),
  initialMessage: z.string().min(1).max(4000).optional(),
});
export class CreateTicketDto extends createZodDto(createTicketSchema) {}
