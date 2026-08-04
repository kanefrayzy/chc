import type { ApiError } from '@chcgreen/shared';

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return (
      process.env.INTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://api:4000'
    );
  }
  // In the browser: always use same-origin /api (works regardless of domain)
  return window.location.origin + '/api';
}

/** Singleton refresh promise — prevents concurrent refresh calls */
let _refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = fetch(`${getApiBaseUrl()}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => { _refreshPromise = null; });
  return _refreshPromise;
}

export class ApiException extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError | { message?: string } | null,
  ) {
    super(typeof body === 'object' && body && 'message' in body ? String(body.message) : `HTTP ${status}`);
    this.name = 'ApiException';
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
}

export async function apiFetch<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const url = `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const fetchOpts = {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      // Серверный рендер ходит в API из контейнера — помечаем такие запросы
      // своими, иначе они делят один лимит частоты на всех
      ...(typeof window === 'undefined' && process.env.INTERNAL_API_KEY
        ? { 'x-internal-client': process.env.INTERNAL_API_KEY }
        : {}),
      ...options.headers,
    } as Record<string, string>,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    credentials: (options.credentials ?? 'include') as RequestCredentials,
    signal: options.signal,
    cache: 'no-store' as RequestCache,
  };

  let res = await fetch(url, fetchOpts);

  // Auto-refresh: если 401 и мы на клиенте и это не сам refresh-endpoint
  if (res.status === 401 && typeof window !== 'undefined' && !path.includes('/auth/refresh')) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      res = await fetch(url, fetchOpts);
    } else {
      // Refresh провалился — разлогиниваемся из админки
      window.location.href = '/vkadm/login';
      throw new ApiException(401, { message: 'Session expired' });
    }
  }

  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    throw new ApiException(res.status, data as ApiError | null);
  }
  return data as T;
}
