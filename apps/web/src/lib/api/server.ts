import { cookies } from 'next/headers';
import { apiFetch, ApiException } from './client';
import type { AuthResponse } from './auth';

/**
 * Получить текущего пользователя на сервере, прокидывая cookie из запроса.
 * Возвращает null, если пользователь не авторизован.
 */
export async function getServerUser(): Promise<AuthResponse['user'] | null> {
  const cookieHeader = cookies()
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  if (!cookieHeader) return null;

  try {
    const res = await apiFetch<AuthResponse>('/auth/me', {
      headers: { Cookie: cookieHeader },
    });
    return res.user;
  } catch (e) {
    if (e instanceof ApiException && (e.status === 401 || e.status === 403 || e.status === 404)) {
      return null;
    }
    throw e;
  }
}
