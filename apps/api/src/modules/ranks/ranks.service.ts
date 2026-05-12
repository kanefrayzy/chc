import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Prisma, Rank } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.module';
import { DEFAULT_RANKS } from './ranks.constants';

@Injectable()
export class RanksService implements OnModuleInit {
  private readonly logger = new Logger(RanksService.name);
  private cache: Rank[] | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaults();
  }

  private async seedDefaults(): Promise<void> {
    for (const r of DEFAULT_RANKS) {
      await this.prisma.rank.upsert({
        where: { order: r.order },
        update: {
          slug: r.slug,
          nameRu: r.nameRu,
          nameAz: r.nameAz,
          minWageredMinor: r.minWageredMinor,
          iconUrl: r.iconUrl,
        },
        create: {
          order: r.order,
          slug: r.slug,
          nameRu: r.nameRu,
          nameAz: r.nameAz,
          minWageredMinor: r.minWageredMinor,
          iconUrl: r.iconUrl,
        },
      });
    }
    this.logger.log(`Seeded/verified ${DEFAULT_RANKS.length} ranks`);
  }

  private async getAllCached(): Promise<Rank[]> {
    if (!this.cache) {
      this.cache = await this.prisma.rank.findMany({ orderBy: { order: 'asc' } });
    }
    return this.cache;
  }

  invalidateCache(): void {
    this.cache = null;
  }

  async listAll(): Promise<Rank[]> {
    return this.getAllCached();
  }

  /** Возвращает (current, next) для данного totalWagered. */
  async pickForWagered(totalWagered: bigint): Promise<{ current: Rank | null; next: Rank | null }> {
    const all = await this.getAllCached();
    let current: Rank | null = null;
    let next: Rank | null = null;
    for (const r of all) {
      if (r.minWageredMinor <= totalWagered) {
        current = r;
      } else {
        next = r;
        break;
      }
    }
    return { current, next };
  }

  async getProgress(userId: string): Promise<{
    totalWageredMinor: bigint;
    current: Rank | null;
    next: Rank | null;
    progressBps: number;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totalWageredMinor: true },
    });
    const total = user?.totalWageredMinor ?? 0n;
    const { current, next } = await this.pickForWagered(total);

    let progressBps = 10_000;
    if (next && current) {
      const span = next.minWageredMinor - current.minWageredMinor;
      const gained = total - current.minWageredMinor;
      if (span > 0n) {
        const bps = (gained * 10_000n) / span;
        const clamped = bps < 0n ? 0n : bps > 10_000n ? 10_000n : bps;
        progressBps = Number(clamped);
      }
    } else if (next && !current) {
      progressBps = 0;
    }

    return { totalWageredMinor: total, current, next, progressBps };
  }

  /**
   * Обновляет rankId пользователя по его totalWageredMinor.
   * Должен вызываться после ставок/выигрышей. Идемпотентен.
   */
  async syncUserRank(userId: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    const user = await client.user.findUnique({
      where: { id: userId },
      select: { totalWageredMinor: true, rankId: true },
    });
    if (!user) return;
    const { current } = await this.pickForWagered(user.totalWageredMinor);
    const targetId = current?.id ?? null;
    if (targetId !== user.rankId) {
      await client.user.update({ where: { id: userId }, data: { rankId: targetId } });
      this.logger.log(`User ${userId} rank → ${current?.slug ?? 'null'} (wagered=${user.totalWageredMinor})`);
    }
  }
}
