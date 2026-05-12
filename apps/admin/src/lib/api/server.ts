import { cookies } from 'next/headers';
import { apiFetch, ApiException } from './client';
import type { PublicUser } from '@chcgreen/shared';

export interface AuthResponse {
  user: PublicUser;
}

/** Server-only: получить cookie-заголовок для проксирования запросов в API. */
export function cookieHeaderFromRequest(): string {
  return cookies()
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}

/**
 * Возвращает текущего пользователя, или null если не авторизован.
 * НЕ проверяет роль — это делает каждый layout/page.
 */
export async function getServerUser(): Promise<PublicUser | null> {
  const cookieHeader = cookieHeaderFromRequest();
  if (!cookieHeader) return null;
  try {
    const res = await apiFetch<AuthResponse>('/auth/me', {
      headers: { Cookie: cookieHeader },
    });
    return res.user;
  } catch (e) {
    if (e instanceof ApiException && (e.status === 401 || e.status === 403)) {
      return null;
    }
    throw e;
  }
}

export function isStaff(user: PublicUser | null): boolean {
  return user?.role === 'MODERATOR' || user?.role === 'SUPER_ADMIN';
}

export function isSuperAdmin(user: PublicUser | null): boolean {
  return user?.role === 'SUPER_ADMIN';
}
