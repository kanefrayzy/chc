-- Реквизиты перевода от провайдера (банк, владелец карты) для отображения пользователю.
ALTER TABLE "Deposit" ADD COLUMN IF NOT EXISTS "requisiteDetails" JSONB;
