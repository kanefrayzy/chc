import { apiFetch } from './client';

export type ClassicRoundStatus = 'OPEN' | 'ROLLING' | 'COMPLETED' | 'CANCELLED';

export interface ClassicParticipantDto {
  userId: string;
  username: string;
  avatarUrl: string | null;
  totalMinor: string;
  betsCount: number;
  chanceBps: number;
  ticketsFrom: number;
  ticketsTo: number;
  color: string;
}

export interface ClassicRoundDto {
  id: string;
  status: ClassicRoundStatus;
  serverSeedHash: string;
  serverSeed: string | null;
  publicSeed: string | null;
  bankMinor: string;
  commissionBps: number;
  payoutMinor: string;
  winnerId: string | null;
  winnerUsername: string | null;
  winnerAvatarUrl: string | null;
  winningTicket: number | null;
  startedAt: string;
  endsAt: string;
  countdownStartedAt: string | null;
  completedAt: string | null;
  participants: ClassicParticipantDto[];
}

export interface ClassicBetDto {
  id: string;
  roundId: string;
  userId: string;
  username?: string;
  avatarUrl?: string | null;
  amountMinor: string;
  ticketsFrom: number;
  ticketsTo: number;
  createdAt: string;
}

export interface ClassicLimitsDto {
  minBetMinor: string;
  maxBetMinor: string;
  roundDurationSec: number;
  rollingDurationSec: number;
  minPlayersToStart: number;
}

export interface ClassicStateDto {
  round: ClassicRoundDto | null;
}

export const classicApi = {
  state: () => apiFetch<ClassicStateDto>('/classic/state'),
  limits: () => apiFetch<ClassicLimitsDto>('/classic/limits'),
  history: (limit = 20) =>
    apiFetch<{ items: ClassicRoundDto[] }>(`/classic/history?limit=${limit}`),
  myBets: (limit = 30) =>
    apiFetch<{ items: ClassicBetDto[] }>(`/classic/my-bets?limit=${limit}`, {
      credentials: 'include',
    }),
  placeBet: (amountMinor: string) =>
    apiFetch<ClassicBetDto>('/classic/bets', {
      method: 'POST',
      body: { amountMinor },
      credentials: 'include',
    }),
};
