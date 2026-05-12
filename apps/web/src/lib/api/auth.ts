import type { PublicUser, RegisterDto, LoginDto } from '@chcgreen/shared';
import { apiFetch } from './client';

export interface AuthResponse {
  user: PublicUser;
}

export const authApi = {
  register: (dto: RegisterDto): Promise<AuthResponse> =>
    apiFetch<AuthResponse>('/auth/register', { method: 'POST', body: dto }),

  login: (dto: LoginDto): Promise<AuthResponse> =>
    apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: dto }),

  logout: (): Promise<{ ok: true }> => apiFetch('/auth/logout', { method: 'POST' }),

  refresh: (): Promise<{ ok: true }> => apiFetch('/auth/refresh', { method: 'POST' }),

  me: (): Promise<AuthResponse> => apiFetch<AuthResponse>('/auth/me'),
};
