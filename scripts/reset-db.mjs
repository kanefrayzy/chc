#!/usr/bin/env node
/**
 * reset-db.mjs — сброс данных и создание первого администратора.
 *
 * Запуск на сервере:
 *   cd /opt/chcgreen
 *   docker compose exec api node /tmp/reset-db.mjs
 *
 * Или локально (с DATABASE_URL из env):
 *   node scripts/reset-db.mjs
 *
 * Удаляет: пользователей и всё связанное (транзакции, депозиты,
 *   выводы, тикеты, сообщения, ставки и т.д.)
 * Оставляет: Settings, Rank, PaymentMethod, RouletteSetting
 * Создаёт: admin@vulkanaz.com / vulk2026@ / role=SUPER_ADMIN
 */

import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

function generateReferralCode() {
  return randomBytes(4).toString('hex').toUpperCase();
}

async function main() {
  console.log('🗑  Удаляем пользовательские данные...');

  // Delete in dependency order to avoid FK violations
  // (Cascade deletions handle most children, but explicit order is safer)
  await prisma.$transaction([
    prisma.referralEarning.deleteMany(),
    prisma.rouletteBet.deleteMany(),
    prisma.jackpotBet.deleteMany(),
    prisma.caseOpening.deleteMany(),
    prisma.message.deleteMany(),
    prisma.ticket.deleteMany(),
    prisma.codePurchase.deleteMany(),
    prisma.withdrawal.deleteMany(),
    prisma.deposit.deleteMany(),
    prisma.transaction.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  console.log('✅ Данные очищены.');

  const email = 'admin@vulkanaz.com';
  const username = 'admin';
  const password = 'vulk2026@';

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const referralCode = generateReferralCode();

  const admin = await prisma.user.create({
    data: {
      email,
      username,
      passwordHash,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      referralCode,
      language: 'ru',
    },
  });

  console.log(`✅ Администратор создан:`);
  console.log(`   email:    ${email}`);
  console.log(`   username: ${username}`);
  console.log(`   password: ${password}`);
  console.log(`   id:       ${admin.id}`);
}

main()
  .catch((e) => {
    console.error('❌ Ошибка:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
