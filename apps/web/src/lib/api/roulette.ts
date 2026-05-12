import { apiFetch } from './client';

export type RouletteColor = 'BLACK' | 'RED' | 'GREEN';
export type RouletteRoundStatus = 'BETTING' | 'ROLLING' | 'COMPLETED' | 'CANCELLED';

export interface RouletteRoundDto {
  id: string;
  status: RouletteRoundStatus;
  serverSeedHash: string;
  serverSeed: string | null;
  publicSeed: string | null;
  winningColor: RouletteColor | null;
  winningSlot: number | null;
  startedAt: string;
  bettingEndsAt: string;
  completedAt: string | null;
  totals: Record<RouletteColor, { amountMinor: string; betsCount: number }>;
  multipliers: Record<RouletteColor, number>;
}

export interface RouletteBetDto {
  id: string;
  roundId: string;
  userId: string;
  username?: string;
  color: RouletteColor;
  amountMinor: string;
  payoutMinor: string;
  isWinner: boolean;
  createdAt: string;
}

export interface RouletteStateDto {
  round: RouletteRoundDto | null;
  recentBets: RouletteBetDto[];
}

export interface PlaceBetRequest {
  color: RouletteColor;
  amountMinor: string;
}

export const rouletteApi = {
  state: () => apiFetch<RouletteStateDto>('/roulette/state'),
  history: (limit = 20) => apiFetch<{ items: RouletteRoundDto[] }>(`/roulette/history?limit=${limit}`),
  myBets: (limit = 30) =>
    apiFetch<{ items: RouletteBetDto[] }>(`/roulette/my-bets?limit=${limit}`, {
      credentials: 'include',
    }),
  placeBet: (req: PlaceBetRequest) =>
    apiFetch<RouletteBetDto>('/roulette/bets', {
      method: 'POST',
      body: req,
      credentials: 'include',
    }),
};
