import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const sendMessageSchema = z.object({
  body: z.string().min(1).max(4000),
});
export class SendMessageDto extends createZodDto(sendMessageSchema) {}
