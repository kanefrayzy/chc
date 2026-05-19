import { apiFetch } from './client';

export type MinesGameStatus = 'ACTIVE' | 'CASHED_OUT' | 'BUSTED' | 'CANCELLED';

export interface MinesGameDto {
  id: string;
  status: MinesGameStatus;
  betMinor: string;
  mineCount: number;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  revealedTiles: number[];
  /** null пока игра активна, массив позиций мин после завершения. */
  minePositions: number[] | null;
  /** null пока игра активна, серверный seed для проверки после завершения. */
  serverSeed: string | null;
  multiplierBps: number;
  nextMultiplierBps: number | null;
  currentPayoutMinor: string;
  payoutMinor: string;
  startedAt: string;
  completedAt: string | null;
}

export interface MinesLimitsDto {
  minBetMinor: string;
  maxBetMinor: string;
  minMines: number;
  maxMines: number;
  totalTiles: number;
}

export interface StartMinesRequest {
  amountMinor: string;
  mineCount: number;
  clientSeed?: string;
}

export const minesApi = {
  limits: () => apiFetch<MinesLimitsDto>('/mines/limits'),
  state: () =>
    apiFetch<{ game: MinesGameDto | null }>('/mines/state', { credentials: 'include' }),
  history: (limit = 30) =>
    apiFetch<{ items: MinesGameDto[] }>(`/mines/history?limit=${limit}`, {
      credentials: 'include',
    }),
  start: (req: StartMinesRequest) =>
    apiFetch<MinesGameDto>('/mines/start', {
      method: 'POST',
      body: req,
      credentials: 'include',
    }),
  reveal: (tile: number) =>
    apiFetch<MinesGameDto>('/mines/reveal', {
      method: 'POST',
      body: { tile },
      credentials: 'include',
    }),
  cashout: () =>
    apiFetch<MinesGameDto>('/mines/cashout', {
      method: 'POST',
      credentials: 'include',
    }),
};
