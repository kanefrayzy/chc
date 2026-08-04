-- Остаток отчисления в джекпот меньше одного qəpik.
--
-- Без него ставка 0.5 AZN при 50 bps давала 0.25 qəpik, округлялась вниз
-- до нуля, и копилка не росла вообще. Теперь дробная часть копится здесь
-- в сотых долях qəpik и переливается в копилку, когда наберётся единица.
ALTER TABLE "ProgressiveJackpot"
  ADD COLUMN IF NOT EXISTS "contributionCarry" BIGINT NOT NULL DEFAULT 0;
