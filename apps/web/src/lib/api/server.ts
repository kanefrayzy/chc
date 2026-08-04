import { cache } from 'react';
import { cookies } from 'next/headers';
import { apiFetch, ApiException } from './client';
import type { AuthResponse } from './auth';

/**
 * Получить текущего пользователя на сервере, прокидывая cookie из запроса.
 * Возвращает null, если пользователь не авторизован.
 *
 * Обёрнут в cache(): за один рендер пользователя спрашивают и макет, и сама
 * страница, а иногда и внутренние компоненты — запрос уйдёт один раз.
 * Кэш живёт ровно в пределах запроса, между посетителями ничего не течёт.
 */
export const getServerUser = cache(async function getServerUser(): Promise<
  AuthResponse['user'] | null
> {
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
    // Перегрузка — не повод отдавать страницу ошибкой: покажем её как гостю,
    // следующий заход подтянет сессию. Реальные поломки по-прежнему всплывают.
    if (e instanceof ApiException && (e.status === 429 || e.status === 503)) {
      console.warn(`[getServerUser] API перегружен (${e.status}), рендерим как гостя`);
      return null;
    }
    throw e;
  }
});
