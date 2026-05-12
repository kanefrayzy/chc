import type { ApiError } from '@chcgreen/shared';

/**
 * Базовый URL API. На клиенте — NEXT_PUBLIC_API_URL, на сервере — внутренний хост
 * Docker-сети (api:4000), если выставлен INTERNAL_API_URL.
 */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return (
      process.env.INTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://api:4000'
    );
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
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
  /** прокидывать ли cookies — для auth-эндпоинтов всегда true */
  credentials?: RequestCredentials;
}

export async function apiFetch<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const url = `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    credentials: options.credentials ?? 'include',
    signal: options.signal,
    cache: 'no-store',
  });

  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    throw new ApiException(res.status, data as ApiError | null);
  }
  return data as T;
}
