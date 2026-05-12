import { z } from 'zod';
import { registerSchema, loginSchema } from '@chcgreen/shared';
import { createZodDto } from 'nestjs-zod';

/** DTO регистрации. На бэке язык опционален (по умолчанию ru). */
export const registerApiSchema = registerSchema.extend({
  language: z.enum(['ru', 'az']).optional(),
});

export class RegisterRequestDto extends createZodDto(registerApiSchema) {}

export class LoginRequestDto extends createZodDto(loginSchema) {}
