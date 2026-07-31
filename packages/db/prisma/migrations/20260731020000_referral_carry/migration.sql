-- Антиминус реферальной программы: бонус платится с чистой маржи казино по игроку,
-- отрицательная маржа переносится вперёд (см. ADR-0008).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCarryMinor" BIGINT NOT NULL DEFAULT 0;
