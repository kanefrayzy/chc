/**
 * Конфигурация JWT/cookies. Загружается из env при старте.
 */
export interface AuthConfig {
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  accessTokenTtlSec: number;
  refreshTokenTtlSec: number;
  cookieDomain?: string;
  cookieSecure: boolean;
}

export function loadAuthConfig(): AuthConfig {
  const jwtAccessSecret = process.env.JWT_ACCESS_SECRET;
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!jwtAccessSecret || !jwtRefreshSecret) {
    throw new Error('JWT_ACCESS_SECRET и JWT_REFRESH_SECRET обязательны');
  }
  return {
    jwtAccessSecret,
    jwtRefreshSecret,
    accessTokenTtlSec: Number(process.env.JWT_ACCESS_TTL_SEC ?? 900), // 15m
    refreshTokenTtlSec: Number(process.env.JWT_REFRESH_TTL_SEC ?? 60 * 60 * 24 * 30), // 30d
    cookieDomain: process.env.COOKIE_DOMAIN || undefined,
    cookieSecure: process.env.COOKIE_SECURE === 'true',
  };
}

export const AUTH_COOKIE = {
  access: 'chc_at',
  refresh: 'chc_rt',
} as const;
