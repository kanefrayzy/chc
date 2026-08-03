-- Прогрессивный джекпот, магазин кодов и моментальная лотерея

-- ── типы ────────────────────────────────────────────────────────────────
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'PROGRESSIVE_WIN';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'CODE_SHOP_BUY';

DO $$ BEGIN
  CREATE TYPE "ProgressiveTier" AS ENUM ('GRAND', 'MAJOR', 'MINOR', 'MINI');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CodeItemStatus" AS ENUM ('AVAILABLE', 'SOLD', 'DISABLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── прогрессивный джекпот ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ProgressiveJackpot" (
  "tier"            "ProgressiveTier" NOT NULL,
  "seedMinor"       BIGINT NOT NULL DEFAULT 0,
  "currentMinor"    BIGINT NOT NULL DEFAULT 0,
  "contributionBps" INTEGER NOT NULL DEFAULT 0,
  "enabled"         BOOLEAN NOT NULL DEFAULT true,
  "lastWonAt"       TIMESTAMP(3),
  "lastWinnerName"  TEXT,
  "lastWinMinor"    BIGINT NOT NULL DEFAULT 0,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProgressiveJackpot_pkey" PRIMARY KEY ("tier")
);

CREATE TABLE IF NOT EXISTS "ProgressiveJackpotWin" (
  "id"                   TEXT NOT NULL,
  "tier"                 "ProgressiveTier" NOT NULL,
  "userId"               TEXT NOT NULL,
  "amountMinor"          BIGINT NOT NULL,
  "awardedByModeratorId" TEXT,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProgressiveJackpotWin_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProgressiveJackpotWin_createdAt_idx" ON "ProgressiveJackpotWin"("createdAt");
CREATE INDEX IF NOT EXISTS "ProgressiveJackpotWin_userId_idx" ON "ProgressiveJackpotWin"("userId");

DO $$ BEGIN
  ALTER TABLE "ProgressiveJackpotWin"
    ADD CONSTRAINT "ProgressiveJackpotWin_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Стартовые копилки. ВАЖНО: seedMinor — реальные деньги: при срыве игрок
-- получает всю копилку, а она откатывается к этому значению. Значения ниже
-- намеренно консервативные, поднимать их следует осознанно из админки.
-- Отчисления в bps: суммарно 100 bps = 1% оборота.
INSERT INTO "ProgressiveJackpot" ("tier", "seedMinor", "currentMinor", "contributionBps", "updatedAt")
VALUES
  ('GRAND', 500000, 500000, 50, NOW()),   -- 5 000 AZN
  ('MAJOR', 100000, 100000, 25, NOW()),   -- 1 000 AZN
  ('MINOR',  20000,  20000, 15, NOW()),   --   200 AZN
  ('MINI',    5000,   5000, 10, NOW())    --    50 AZN
ON CONFLICT ("tier") DO NOTHING;

-- ── магазин кодов ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CodeProduct" (
  "id"                TEXT NOT NULL,
  "name"              TEXT NOT NULL,
  "denominationMinor" BIGINT NOT NULL,
  "priceMinor"        BIGINT NOT NULL,
  "description"       TEXT,
  "iconUrl"           TEXT,
  "displayOrder"      INTEGER NOT NULL DEFAULT 0,
  "enabled"           BOOLEAN NOT NULL DEFAULT true,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CodeProduct_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CodeProduct_enabled_displayOrder_idx" ON "CodeProduct"("enabled", "displayOrder");

CREATE TABLE IF NOT EXISTS "CodeItem" (
  "id"         TEXT NOT NULL,
  "productId"  TEXT NOT NULL,
  "code"       TEXT NOT NULL,
  "status"     "CodeItemStatus" NOT NULL DEFAULT 'AVAILABLE',
  "soldToId"   TEXT,
  "soldAt"     TIMESTAMP(3),
  "priceMinor" BIGINT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CodeItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CodeItem_productId_code_key" ON "CodeItem"("productId", "code");
CREATE INDEX IF NOT EXISTS "CodeItem_productId_status_idx" ON "CodeItem"("productId", "status");
CREATE INDEX IF NOT EXISTS "CodeItem_soldToId_soldAt_idx" ON "CodeItem"("soldToId", "soldAt");

DO $$ BEGIN
  ALTER TABLE "CodeItem"
    ADD CONSTRAINT "CodeItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "CodeProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CodeItem"
    ADD CONSTRAINT "CodeItem_soldToId_fkey"
    FOREIGN KEY ("soldToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── лотерея ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "LotteryTicket" (
  "id"             TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "betMinor"       BIGINT NOT NULL,
  "prizeMinor"     BIGINT NOT NULL DEFAULT 0,
  "symbols"        INTEGER[],
  "winningSymbol"  INTEGER,
  "serverSeed"     TEXT NOT NULL,
  "serverSeedHash" TEXT NOT NULL,
  "clientSeed"     TEXT NOT NULL,
  "nonce"          INTEGER NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LotteryTicket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LotteryTicket_userId_createdAt_idx" ON "LotteryTicket"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "LotteryTicket_createdAt_idx" ON "LotteryTicket"("createdAt");

DO $$ BEGIN
  ALTER TABLE "LotteryTicket"
    ADD CONSTRAINT "LotteryTicket_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
