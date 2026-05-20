import type { JackpotBet, JackpotRound } from '@prisma/client';
import { minorToJson } from '@chcgreen/shared';

export interface PublicClassicBetDto {
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

export interface PublicClassicParticipant {
  userId: string;
  username: string;
  avatarUrl: string | null;
  totalMinor: string;
  betsCount: number;
  chanceBps: number; // 0..10000
  ticketsFrom: number;
  ticketsTo: number;
  color: string; // hex (детерминированно от userId)
}

export interface PublicClassicRoundDto {
  id: string;
  status: JackpotRound['status'];
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
  participants: PublicClassicParticipant[];
}

/**
 * Подбирает hex-цвет для игрока на основе его userId (детерминированно).
 * Используется для маркера ставки на полосе.
 */
const PARTICIPANT_COLORS = [
  '#22d3ee', '#a855f7', '#f97316', '#ec4899', '#84cc16',
  '#0ea5e9', '#facc15', '#10b981', '#f43f5e', '#6366f1',
];

export function colorForUserId(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % PARTICIPANT_COLORS.length;
  return PARTICIPANT_COLORS[idx] as string;
}

export function toPublicClassicBet(
  b: JackpotBet & { user?: { username: string; avatarUrl?: string | null } | null },
): PublicClassicBetDto {
  return {
    id: b.id,
    roundId: b.roundId,
    userId: b.userId,
    ...(b.user ? { username: b.user.username, avatarUrl: b.user.avatarUrl ?? null } : {}),
    amountMinor: minorToJson(b.amountMinor),
    ticketsFrom: b.ticketsFrom,
    ticketsTo: b.ticketsTo,
    createdAt: b.createdAt.toISOString(),
  };
}

interface UserLite {
  id: string;
  username: string;
  avatarUrl?: string | null;
}

export function toPublicClassicRound(
  round: JackpotRound & { winner?: UserLite | null },
  bets: Array<JackpotBet & { user?: UserLite | null }>,
  opts?: { revealServerSeed?: boolean; countdownStartedAt?: Date | null },
): PublicClassicRoundDto {
  const reveal = opts?.revealServerSeed ?? round.status === 'COMPLETED';
  const bank = round.bankMinor;

  // Агрегируем по пользователю
  const byUser = new Map<string, {
    user: UserLite | null;
    total: bigint;
    count: number;
    minFrom: number;
    maxTo: number;
  }>();
  for (const b of bets) {
    const prev = byUser.get(b.userId);
    if (prev) {
      prev.total += b.amountMinor;
      prev.count += 1;
      if (b.ticketsFrom < prev.minFrom) prev.minFrom = b.ticketsFrom;
      if (b.ticketsTo > prev.maxTo) prev.maxTo = b.ticketsTo;
    } else {
      byUser.set(b.userId, {
        user: b.user ?? null,
        total: b.amountMinor,
        count: 1,
        minFrom: b.ticketsFrom,
        maxTo: b.ticketsTo,
      });
    }
  }

  const participants: PublicClassicParticipant[] = [...byUser.entries()]
    .map(([userId, info]) => {
      const chanceBps = bank > 0n
        ? Number((info.total * 10_000n) / bank)
        : 0;
      return {
        userId,
        username: info.user?.username ?? 'player',
        avatarUrl: info.user?.avatarUrl ?? null,
        totalMinor: minorToJson(info.total),
        betsCount: info.count,
        chanceBps,
        ticketsFrom: info.minFrom,
        ticketsTo: info.maxTo,
        color: colorForUserId(userId),
      };
    })
    .sort((a, b) => Number(BigInt(b.totalMinor) - BigInt(a.totalMinor)));

  // Сколько уже выплачено (на основании ставок выигравшего)
  let payoutMinor = 0n;
  if (round.status === 'COMPLETED' && round.winnerId) {
    const winnerInfo = byUser.get(round.winnerId);
    // Сумма банка минус комиссия
    const remain = 10_000n - BigInt(round.commissionRateBps);
    payoutMinor = (bank * remain) / 10_000n;
    // если в раунде только один игрок — выплат не было
    if (!winnerInfo) payoutMinor = 0n;
  }

  return {
    id: round.id,
    status: round.status,
    serverSeedHash: round.serverSeedHash,
    serverSeed: reveal ? round.serverSeed : null,
    publicSeed: round.publicSeed,
    bankMinor: minorToJson(bank),
    commissionBps: round.commissionRateBps,
    payoutMinor: minorToJson(payoutMinor),
    winnerId: round.winnerId,
    winnerUsername: round.winner?.username ?? null,
    winnerAvatarUrl: round.winner?.avatarUrl ?? null,
    winningTicket: round.winningTicket,
    startedAt: round.startedAt.toISOString(),
    endsAt: round.endsAt.toISOString(),
    countdownStartedAt: opts?.countdownStartedAt?.toISOString() ?? null,
    completedAt: round.completedAt?.toISOString() ?? null,
    participants,
  };
}
