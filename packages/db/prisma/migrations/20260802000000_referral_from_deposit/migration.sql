-- Реферальный бонус с пополнений приглашённого игрока.
ALTER TYPE "ReferralEarningKind" ADD VALUE IF NOT EXISTS 'FROM_DEPOSIT';
