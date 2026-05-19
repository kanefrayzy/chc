-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "MinesGameStatus" AS ENUM ('ACTIVE', 'CASHED_OUT', 'BUSTED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "MinesGame" (
  "id"             TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "status"         "MinesGameStatus" NOT NULL DEFAULT 'ACTIVE',
  "betMinor"       BIGINT NOT NULL,
  "mineCount"      INTEGER NOT NULL,
  "serverSeed"     TEXT NOT NULL,
  "serverSeedHash" TEXT NOT NULL,
  "clientSeed"     TEXT NOT NULL,
  "nonce"          INTEGER NOT NULL DEFAULT 0,
  "minePositions"  INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "revealedTiles"  INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "multiplierBps"  INTEGER NOT NULL DEFAULT 10000,
  "payoutMinor"    BIGINT NOT NULL DEFAULT 0,
  "startedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"    TIMESTAMP(3),

  CONSTRAINT "MinesGame_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MinesGame_userId_status_idx" ON "MinesGame"("userId", "status");
CREATE INDEX IF NOT EXISTS "MinesGame_userId_startedAt_idx" ON "MinesGame"("userId", "startedAt");

-- Only one ACTIVE game per user (race-condition safe)
CREATE UNIQUE INDEX IF NOT EXISTS "MinesGame_userId_active_unique"
  ON "MinesGame"("userId")
  WHERE "status" = 'ACTIVE';

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "MinesGame" ADD CONSTRAINT "MinesGame_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
