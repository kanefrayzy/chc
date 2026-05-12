import { apiFetch } from './client';
import type { PublicUser } from '@chcgreen/shared';

export interface LoginPayload {
  identifier: string;
  password: string;
}

export interface AuthResponse {
  user: PublicUser;
}

export const adminAuthApi = {
  login: (dto: LoginPayload) =>
    apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: dto }),
  logout: () => apiFetch<{ ok: true }>('/auth/logout', { method: 'POST' }),
  me: () => apiFetch<AuthResponse>('/auth/me'),
};
