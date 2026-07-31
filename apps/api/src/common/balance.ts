import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

/**
 * Атомарное списание с баланса.
 *
 * Читать баланс через findUnique, сравнивать в коде и потом писать decrement — небезопасно:
 * при уровне изоляции READ COMMITTED параллельные запросы видят один и тот же баланс
 * и все проходят проверку (двойное списание / уход в минус).
 *
 * Здесь условие «хватает средств» переносится в сам UPDATE: Postgres после снятия блокировки
 * строки перепроверяет WHERE, поэтому второй запрос получит count = 0 и откатится.
 *
 * @returns баланс после списания
 * @throws ConflictException('INSUFFICIENT_FUNDS')
 */
export async function debitBalance(
  tx: Prisma.TransactionClient,
  userId: string,
  amountMinor: bigint,
  opts: { wager?: boolean } = {},
): Promise<bigint> {
  if (amountMinor <= 0n) throw new ConflictException('INVALID_AMOUNT');

  const res = await tx.user.updateMany({
    where: { id: userId, balanceMinor: { gte: amountMinor } },
    data: {
      balanceMinor: { decrement: amountMinor },
      ...(opts.wager ? { totalWageredMinor: { increment: amountMinor } } : {}),
    },
  });
  if (res.count !== 1) throw new ConflictException('INSUFFICIENT_FUNDS');

  const user = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: { balanceMinor: true },
  });
  return user.balanceMinor;
}
