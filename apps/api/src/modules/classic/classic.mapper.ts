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
 * Палитра цветов участников. Цвета назначаются по индексу в раунде (уникальны в пределах раунда).
 * Для >24 участников используется HSL с золотым углом.
 */
const PARTICIPANT_COLORS = [
  '#22d3ee', '#a855f7', '#f97316', '#ec4899', '#84cc16',
  '#0ea5e9', '#facc15', '#10b981', '#f43f5e', '#6366f1',
  '#14b8a6', '#d946ef', '#eab308', '#3b82f6', '#ef4444',
  '#22c55e', '#8b5cf6', '#fb923c', '#06b6d4', '#e11d48',
  '#65a30d', '#c026d3', '#0891b2', '#dc2626',
];

function colorForIndex(i: number): string {
  if (i < PARTICIPANT_COLORS.length) return PARTICIPANT_COLORS[i] as string;
  // золотой угол для равномерного распределения
  const h = (i * 137.508) % 360;
  return `hsl(${h.toFixed(1)}, 70%, 55%)`;
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

  // Стабильный порядок для назначения цветов — по ticketsFrom (порядок вхождения в раунд).
  const orderedUserIds = [...byUser.entries()]
    .sort((a, b) => a[1].minFrom - b[1].minFrom)
    .map(([uid]) => uid);
  const colorByUser = new Map<string, string>();
  orderedUserIds.forEach((uid, i) => colorByUser.set(uid, colorForIndex(i)));

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
        color: colorByUser.get(userId) ?? colorForIndex(0),
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
