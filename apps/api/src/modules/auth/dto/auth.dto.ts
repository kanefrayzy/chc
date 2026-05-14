import { z } from 'zod';
import { registerBaseSchema, loginSchema } from '@chcgreen/shared';
import { createZodDto } from 'nestjs-zod';

/** DTO регистрации. На бэке язык опционален (по умолчанию ru). */
export const registerApiSchema = registerBaseSchema.extend({
  language: z.enum(['ru', 'az']).optional(),
}).refine(
  (data) => data.email !== '' || data.phone !== '',
  { message: 'Укажите email или телефон', path: ['email'] },
);

export class RegisterRequestDto extends createZodDto(registerApiSchema) {}

export class LoginRequestDto extends createZodDto(loginSchema) {}
