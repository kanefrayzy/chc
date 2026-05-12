import type { Rank } from '@prisma/client';
import { minorToJson } from '@chcgreen/shared';

export interface PublicRankDto {
  id: string;
  order: number;
  slug: string;
  nameRu: string;
  nameAz: string;
  minWageredMinor: string;
  iconUrl: string | null;
}

export function toPublicRank(r: Rank): PublicRankDto {
  return {
    id: r.id,
    order: r.order,
    slug: r.slug,
    nameRu: r.nameRu,
    nameAz: r.nameAz,
    minWageredMinor: minorToJson(r.minWageredMinor),
    iconUrl: r.iconUrl,
  };
}

export interface MyRankProgressDto {
  totalWageredMinor: string;
  current: PublicRankDto | null;
  next: PublicRankDto | null;
  progressBps: number; // 0..10000 — доля до следующего ранга, в bps; 10000 если максимальный.
}
