import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@prisma/client';

export const ROLES_KEY = 'chc:roles';

/**
 * Ограничивает доступ ручки списком ролей.
 * Применяется поверх JwtAuthGuard.
 */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
