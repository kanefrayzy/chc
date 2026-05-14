import { z } from 'zod';

// =========================================================
// Auth
// =========================================================

export const usernameSchema = z
  .string()
  .min(3)
  .max(20)
  .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, digits and underscore');

export const passwordSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/[0-9]/, 'Must contain a digit');

export const phoneSchema = z
  .string()
  .regex(/^\+?[0-9]{8,15}$/, 'Invalid phone number');

export const registerBaseSchema = z.object({
  email: z.union([z.string().email(), z.literal('')]),
  phone: z.union([phoneSchema, z.literal('')]),
  username: usernameSchema,
  password: passwordSchema,
  referralCode: z.string().optional(),
  ageConfirmed: z.literal(true),
  termsAccepted: z.literal(true),
});

export const registerSchema = registerBaseSchema.refine(
  (data) => data.email !== '' || data.phone !== '',
  { message: 'Укажите email или телефон', path: ['email'] },
);

export type RegisterDto = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  identifier: z.string().min(3), // email или username
  password: z.string().min(1),
});

export type LoginDto = z.infer<typeof loginSchema>;

// =========================================================
// Money input
// =========================================================

export const moneyInputSchema = z
  .string()
  .regex(/^\d+([.,]\d{1,2})?$/, 'Invalid money format');
