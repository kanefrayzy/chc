'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRightIcon, TrophyIcon } from '@/components/icons';
import { rouletteApi, type RecentWinnerDto } from '@/lib/api/roulette';
import { getRealtimeSocket } from '@/lib/realtime/socket';
import { formatMinorAmount } from '@/lib/format/money';

export interface RecentWinnersProps {
  locale: string;
}

type Filter = 'all' | 'big';

/** Ставки с множителем от ×5 считаем «крупными» — они и есть самое интересное в ленте. */
const BIG_MULTIPLIER_BPS = 50_000;
const FEED_LIMIT = 15;

function initials(name: string): string {
  const cleaned = name.replace(/[^a-zA-Zа-яА-Я0-9]/g, '');
  return cleaned.slice(0, 2).toUpperCase();
}

const AVATAR_GRADIENTS = [
  'from-brand/40 to-accent-purple/40',
  'from-info/40 to-brand/30',
  'from-warning/40 to-danger/30',
  'from-accent-purple/40 to-info/30',
  'from-danger/40 to-warning/30',
];

const GAME_BADGE: Record<RecentWinnerDto['game'], { label: string; cls: string }> = {
  roulette: { label: 'Roulette', cls: 'bg-brand/15 text-brand' },
  mines: { label: 'Mines', cls: 'bg-accent-purple/15 text-accent-purple' },
  classic: { label: 'Classic', cls: 'bg-warning/15 text-warning' },
  lottery: { label: 'Лотерея', cls: 'bg-info/15 text-info' },
};

/** Чем больше множитель, тем ярче подсветка — крупные выигрыши видно сразу. */
function multiplierStyle(bps: number | undefined): string {
  if (!bps) return 'bg-bg-elevated text-text-secondary';
  if (bps >= 200_000) return 'bg-danger/20 text-danger ring-1 ring-danger/30';
  if (bps >= BIG_MULTIPLIER_BPS) return 'bg-warning/20 text-warning ring-1 ring-warning/30';
  return 'bg-bg-elevated text-text-secondary';
}

function formatMultiplier(bps: number): string {
  const value = bps / 10_000;
  return value >= 100 ? `×${Math.round(value)}` : `×${value.toFixed(2)}`;
}

/** «только что» / «5 мин» / «2 ч» — без внешних зависимостей. */
function timeAgo(iso: string, now: number): string {
  const diffSec = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (diffSec < 45) return 'только что';
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${Math.max(1, min)} мин`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} ч`;
  return `${Math.floor(hours / 24)} д`;
}

function keyOf(w: RecentWinnerDto): string {
  return `${w.username}-${w.createdAt}-${w.game}-${w.amountMinor}`;
}

export function RecentWinners({ locale }: RecentWinnersProps): JSX.Element {
  const t = useTranslations('winners');
  const [winners, setWinners] = useState<RecentWinnerDto[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [now, setNow] = useState(() => Date.now());
  /** Ключи только что прилетевших записей — подсвечиваем их на пару секунд. */
  const [freshKeys, setFreshKeys] = useState<Set<string>>(new Set());
  const seenKeys = useRef<Set<string> | null>(null);
  const localePrefix = locale === 'ru' ? '' : `/${locale}`;

  useEffect(() => {
    let cancelled = false;

    const apply = (items: RecentWinnerDto[]): void => {
      if (cancelled) return;
      const next = items.slice(0, FEED_LIMIT);
      // Первая загрузка не мигает — подсвечиваем только реально новые записи
      if (seenKeys.current === null) {
        seenKeys.current = new Set(next.map(keyOf));
      } else {
        const fresh = next.map(keyOf).filter((k) => !seenKeys.current!.has(k));
        if (fresh.length > 0) {
          seenKeys.current = new Set(next.map(keyOf));
          setFreshKeys(new Set(fresh));
          setTimeout(() => setFreshKeys(new Set()), 2500);
        }
      }
      setWinners(next);
    };

    rouletteApi
      .recentWinners(FEED_LIMIT)
      .then((res) => apply(res.items))
      .catch(() => {
        if (!cancelled) setWinners([]);
      });

    const socket = getRealtimeSocket();
    const handler = (payload: { items: RecentWinnerDto[] }): void => {
      if (Array.isArray(payload?.items)) apply(payload.items);
    };
    socket.on('roulette:winners', handler);

    // Лента живёт и без ставок (боты появляются по времени) — периодически обновляем
    const poll = setInterval(() => {
      rouletteApi
        .recentWinners(FEED_LIMIT)
        .then((res) => apply(res.items))
        .catch(() => undefined);
    }, 30_000);

    // Пересчёт «сколько времени назад» без перезапроса данных
    const timer = setInterval(() => setNow(Date.now()), 30_000);

    return () => {
      cancelled = true;
      socket.off('roulette:winners', handler);
      clearInterval(poll);
      clearInterval(timer);
    };
  }, []);

  const fmtLocale: 'ru' | 'az' | 'en' =
    locale === 'az' ? 'az' : locale === 'en' ? 'en' : 'ru';

  const bigCount = useMemo(
    () => winners.filter((w) => (w.multiplierBps ?? 0) >= BIG_MULTIPLIER_BPS).length,
    [winners],
  );

  const visible = useMemo(
    () =>
      filter === 'big'
        ? winners.filter((w) => (w.multiplierBps ?? 0) >= BIG_MULTIPLIER_BPS)
        : winners,
    [winners, filter],
  );

  /** Самый крупный выигрыш в ленте — отмечаем короной. */
  const topKey = useMemo(() => {
    let best: RecentWinnerDto | null = null;
    for (const w of winners) {
      if (!best || BigInt(w.amountMinor) > BigInt(best.amountMinor)) best = w;
    }
    return best ? keyOf(best) : null;
  }, [winners]);

  return (
    <section
      aria-labelledby="recent-winners-title"
      className="mt-8 rounded-2xl border border-border bg-bg-card p-4 sm:mt-10 sm:p-5"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2
            id="recent-winners-title"
            className="flex items-center gap-2 text-base font-bold text-text-primary sm:text-lg"
          >
            <TrophyIcon className="h-5 w-5 text-brand" />
            {t('title')}
          </h2>
          <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-text-muted">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
            </span>
            live
          </span>
        </div>

        {/* Фильтр: вся лента или только крупные множители */}
        <div className="flex gap-1 rounded-lg border border-border bg-bg-base/70 p-0.5">
          {([
            { id: 'all' as const, label: 'Все' },
            { id: 'big' as const, label: `Крупные${bigCount > 0 ? ` · ${bigCount}` : ''}` },
          ]).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              aria-pressed={filter === tab.id}
              className={[
                'rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors',
                filter === tab.id
                  ? 'bg-bg-card-hover text-text-primary'
                  : 'text-text-muted hover:text-text-secondary',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="py-10 text-center text-sm text-text-muted">
          {filter === 'big' ? 'Пока нет крупных выигрышей' : t('empty')}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((w, idx) => {
            const k = keyOf(w);
            const isFresh = freshKeys.has(k);
            const isTop = k === topKey;
            const badge = GAME_BADGE[w.game] ?? GAME_BADGE.roulette;
            return (
              <li
                key={k}
                className={[
                  'flex items-center gap-2.5 rounded-lg border px-2 py-2 transition-all duration-500',
                  isFresh
                    ? 'border-brand/30 bg-brand/10'
                    : 'border-transparent bg-bg-base/40 hover:bg-bg-card-hover',
                ].join(' ')}
              >
                <div className="relative shrink-0">
                  {w.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={w.avatarUrl}
                      alt={w.username}
                      className="h-9 w-9 rounded-full object-cover ring-1 ring-border"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className={`flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br ${
                        AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length]
                      } text-[11px] font-bold text-text-primary ring-1 ring-border`}
                    >
                      {initials(w.username)}
                    </span>
                  )}
                  {isTop && (
                    <span
                      aria-label="Крупнейший выигрыш"
                      title="Крупнейший выигрыш"
                      className="absolute -right-1 -top-1 text-[11px] leading-none"
                    >
                      👑
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-text-primary">
                      {w.username}
                    </span>
                    <span className="shrink-0 text-[10px] text-text-muted" suppressHydrationWarning>
                      {timeAgo(w.createdAt, now)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span
                      className={`rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                    {w.game === 'mines' && typeof w.mineCount === 'number' && (
                      <span className="text-[10px] text-text-muted">{w.mineCount} 💣</span>
                    )}
                    {w.game === 'roulette' && w.color && (
                      <span className="text-[10px] text-text-muted">{w.color}</span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="font-mono text-sm font-bold tabular-nums text-brand">
                    {formatMinorAmount(w.amountMinor, {
                      locale: fmtLocale,
                      showPositiveSign: false,
                    })}
                  </div>
                  {typeof w.multiplierBps === 'number' && w.multiplierBps > 0 && (
                    <div
                      className={`mt-0.5 inline-block rounded px-1.5 py-px font-mono text-[10px] font-bold ${multiplierStyle(
                        w.multiplierBps,
                      )}`}
                    >
                      {formatMultiplier(w.multiplierBps)}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Link
        href={`${localePrefix}/roulette`}
        className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-bg-elevated px-3 py-2.5 text-xs font-semibold text-text-secondary transition-colors hover:border-brand/40 hover:bg-brand/10 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        {t('viewAll')}
        <ArrowRightIcon className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}
