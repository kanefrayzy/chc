-- Защита от ухода баланса в минус на уровне БД (последний рубеж поверх атомарных списаний).
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "user_balance_non_negative";
ALTER TABLE "User" ADD CONSTRAINT "user_balance_non_negative" CHECK ("balanceMinor" >= 0);
