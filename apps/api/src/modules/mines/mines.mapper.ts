import type { MinesGame } from '@prisma/client';
import { minorToJson } from '@chcgreen/shared';
import {
  MINES_TOTAL_TILES,
  multiplierBps,
  calculateMinesPayout,
} from './mines.constants';

export interface PublicMinesGameDto {
  id: string;
  status: MinesGame['status'];
  betMinor: string;
  mineCount: number;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  /** Открытые игроком безопасные клетки. */
  revealedTiles: number[];
  /** Позиции мин — раскрываются только при завершении игры. */
  minePositions: number[] | null;
  /** Раскрывается только при завершении игры. */
  serverSeed: string | null;
  /** Текущий множитель × 10000 (1.2345× = 12345). */
  multiplierBps: number;
  /** Множитель × 10000, который получится при следующем успешном открытии. */
  nextMultiplierBps: number | null;
  /** Текущий возможный кешаут в minor units. */
  currentPayoutMinor: string;
  /** Финальная выплата (для CASHED_OUT). 0 для BUSTED. */
  payoutMinor: string;
  startedAt: string;
  completedAt: string | null;
}

/**
 * Превращает запись из БД в DTO. Если игра ещё ACTIVE — позиции мин и
 * `serverSeed` НЕ отдаются (анти-чит).
 */
export function toPublicMinesGame(
  game: MinesGame,
  houseEdgeBps: number,
): PublicMinesGameDto {
  const isCompleted = game.status !== 'ACTIVE';
  const currentMult = multiplierBps(game.mineCount, game.revealedTiles.length, houseEdgeBps);

  const safeTiles = MINES_TOTAL_TILES - game.mineCount;
  const canRevealMore = game.revealedTiles.length < safeTiles;
  const nextMult = canRevealMore
    ? multiplierBps(game.mineCount, game.revealedTiles.length + 1, houseEdgeBps)
    : null;

  const currentPayout =
    game.status === 'ACTIVE'
      ? calculateMinesPayout(game.betMinor, currentMult)
      : game.payoutMinor;

  return {
    id: game.id,
    status: game.status,
    betMinor: minorToJson(game.betMinor),
    mineCount: game.mineCount,
    serverSeedHash: game.serverSeedHash,
    clientSeed: game.clientSeed,
    nonce: game.nonce,
    revealedTiles: [...game.revealedTiles],
    minePositions: isCompleted ? [...game.minePositions] : null,
    serverSeed: isCompleted ? game.serverSeed : null,
    multiplierBps: game.status === 'ACTIVE' ? currentMult : game.multiplierBps,
    nextMultiplierBps: game.status === 'ACTIVE' ? nextMult : null,
    currentPayoutMinor: minorToJson(currentPayout),
    payoutMinor: minorToJson(game.payoutMinor),
    startedAt: game.startedAt.toISOString(),
    completedAt: game.completedAt?.toISOString() ?? null,
  };
}
