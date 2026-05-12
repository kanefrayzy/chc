import type { RouletteBet, RouletteColor, RouletteRound } from '@prisma/client';
import { minorToJson } from '@chcgreen/shared';
import { PAYOUT_MULTIPLIER } from './roulette.constants';

export interface PublicBetDto {
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

export interface PublicRoundDto {
  id: string;
  status: RouletteRound['status'];
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

export function toPublicBet(
  b: RouletteBet & { user?: { username: string } | null },
): PublicBetDto {
  return {
    id: b.id,
    roundId: b.roundId,
    userId: b.userId,
    ...(b.user ? { username: b.user.username } : {}),
    color: b.color,
    amountMinor: minorToJson(b.amountMinor),
    payoutMinor: minorToJson(b.payoutMinor),
    isWinner: b.isWinner,
    createdAt: b.createdAt.toISOString(),
  };
}

export function toPublicRound(
  round: RouletteRound,
  bets: RouletteBet[],
  opts?: { revealServerSeed?: boolean },
): PublicRoundDto {
  const totals = {
    BLACK: { amountMinor: 0n, betsCount: 0 },
    RED: { amountMinor: 0n, betsCount: 0 },
    GREEN: { amountMinor: 0n, betsCount: 0 },
  } as Record<RouletteColor, { amountMinor: bigint; betsCount: number }>;

  for (const b of bets) {
    totals[b.color].amountMinor += b.amountMinor;
    totals[b.color].betsCount += 1;
  }

  const revealSeed = opts?.revealServerSeed ?? round.status === 'COMPLETED';

  return {
    id: round.id,
    status: round.status,
    serverSeedHash: round.serverSeedHash,
    serverSeed: revealSeed ? round.serverSeed : null,
    publicSeed: round.publicSeed,
    winningColor: round.winningColor,
    winningSlot: round.winningSlot,
    startedAt: round.startedAt.toISOString(),
    bettingEndsAt: round.bettingEndsAt.toISOString(),
    completedAt: round.completedAt?.toISOString() ?? null,
    totals: {
      BLACK: { amountMinor: minorToJson(totals.BLACK.amountMinor), betsCount: totals.BLACK.betsCount },
      RED: { amountMinor: minorToJson(totals.RED.amountMinor), betsCount: totals.RED.betsCount },
      GREEN: { amountMinor: minorToJson(totals.GREEN.amountMinor), betsCount: totals.GREEN.betsCount },
    },
    multipliers: PAYOUT_MULTIPLIER,
  };
}
