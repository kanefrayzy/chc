/**
 * Дефолтные ранги. Порядок — order возрастающий, minWageredMinor в qəpik.
 * Сидятся при первом обращении к RanksService (idempotent).
 */
export const DEFAULT_RANKS: ReadonlyArray<{
  order: number;
  slug: string;
  nameRu: string;
  nameAz: string;
  minWageredMinor: bigint;
  iconUrl: string | null;
}> = [
  { order: 1, slug: 'novice', nameRu: 'Новичок', nameAz: 'Yeni başlayan', minWageredMinor: 0n, iconUrl: null },
  { order: 2, slug: 'amateur', nameRu: 'Любитель', nameAz: 'Həvəskar', minWageredMinor: 10_000n, iconUrl: null },
  { order: 3, slug: 'experienced', nameRu: 'Опытный', nameAz: 'Təcrübəli', minWageredMinor: 50_000n, iconUrl: null },
  { order: 4, slug: 'pro', nameRu: 'Профи', nameAz: 'Peşəkar', minWageredMinor: 250_000n, iconUrl: null },
  { order: 5, slug: 'master', nameRu: 'Мастер', nameAz: 'Usta', minWageredMinor: 1_000_000n, iconUrl: null },
  { order: 6, slug: 'champion', nameRu: 'Чемпион', nameAz: 'Çempion', minWageredMinor: 5_000_000n, iconUrl: null },
  { order: 7, slug: 'legend', nameRu: 'Легенда', nameAz: 'Əfsanə', minWageredMinor: 25_000_000n, iconUrl: null },
];
