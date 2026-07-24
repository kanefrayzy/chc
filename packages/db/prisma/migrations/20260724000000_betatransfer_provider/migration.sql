-- Замена платёжного провайдера Betra h2h на Betatransfer (ADR-0007).
-- Переименование значений enum сохраняет существующие строки (депозиты, выводы, методы).
ALTER TYPE "PaymentProvider" RENAME VALUE 'BETRA_H2H' TO 'BETATRANSFER';
ALTER TYPE "WithdrawalMethod" RENAME VALUE 'AUTO_BETRA_H2H' TO 'AUTO_BETATRANSFER';
