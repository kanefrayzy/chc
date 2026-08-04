'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRightIcon, TrophyIcon } from '@/components/icons';
import { rouletteApi, type RecentWinnerDto } from '@/lib/api/roulette';
import { getRealtimeSocket } from '@/lib/realtime/socket';
import { localePrefix } from '@/lib/i18n/prefix';

export interface RecentWinnersProps {
  locale: string;
}

type Filter = 'all' | 'big';

/** Ставки с множителем от ×5 считаем «крупными». */
const BIG_MULTIPLIER_BPS = 50_000;
const FEED_LIMIT = 15;

const GAME_LABEL: Record<RecentWinnerDto['game'], { label: string; cls: string }> = {
  roulette: { label: 'Рулетка', cls: 'bg-brand/15 text-brand' },
  mines: { label: 'Mines', cls: 'bg-accent-purple/15 text-accent-purple' },
  classic: { label: 'Классика', cls: 'bg-warning/15 text-warning' },
  lottery: { label: 'Лотерея', cls: 'bg-info/15 text-info' },
};

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

/** Чем больше множитель, тем ярче — крупные выигрыши видно сразу. */
function multiplierStyle(bps: number | undefined): string {
  if (!bps) return 'text-text-muted';
  if (bps >= 200_000) return 'text-danger';
  if (bps >= BIG_MULTIPLIER_BPS) return 'text-warning';
  return 'text-text-secondary';
}

function formatMultiplier(bps: number): string {
  const value = bps / 10_000;
  return value >= 100 ? `×${Math.round(value)}` : `×${value.toFixed(2)}`;
}

function formatAzn(minor: string): string {
  const value = BigInt(minor);
  const major = value / 100n;
  const frac = (value % 100n).toString().padStart(2, '0');
  return `${major.toLocaleString('ru-RU')},${frac}`;
}

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

/** Подробности раунда: количество мин, цвет рулетки. */
function detailsOf(w: RecentWinnerDto): string {
  if (w.game === 'mines' && typeof w.mineCount === 'number') return `${w.mineCount} мин`;
  if (w.game === 'roulette' && w.color) {
    const map: Record<string, string> = { RED: 'красное', BLACK: 'чёрное', GREEN: 'зелёное' };
    return map[w.color] ?? w.color;
  }
  return '';
}

export function RecentWinners({ locale }: RecentWinnersProps): JSX.Element {
  const t = useTranslations('winners');
  const [winners, setWinners] = useState<RecentWinnerDto[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [now, setNow] = useState(() => Date.now());
  const [freshKeys, setFreshKeys] = useState<Set<string>>(new Set());
  const seenKeys = useRef<Set<string> | null>(null);
  const prefix = localePrefix(locale);

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

    const load = (): void => {
      rouletteApi
        .recentWinners(FEED_LIMIT)
        .then((res) => apply(res.items))
        .catch(() => undefined);
    };

    load();

    const socket = getRealtimeSocket();
    const handler = (payload: { items: RecentWinnerDto[] }): void => {
      if (Array.isArray(payload?.items)) apply(payload.items);
    };
    socket.on('roulette:winners', handler);

    const poll = setInterval(load, 30_000);
    const timer = setInterval(() => setNow(Date.now()), 30_000);

    return () => {
      cancelled = true;
      socket.off('roulette:winners', handler);
      clearInterval(poll);
      clearInterval(timer);
    };
  }, []);

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
      className="mt-8 overflow-hidden rounded-2xl border border-border bg-bg-card sm:mt-10"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
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
        <p className="px-4 py-12 text-center text-sm text-text-muted">
          {filter === 'big' ? 'Пока нет крупных выигрышей' : t('empty')}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wider text-text-muted">
                <th className="px-4 py-2.5 text-left font-semibold sm:px-5">Игрок</th>
                <th className="px-4 py-2.5 text-left font-semibold">Игра</th>
                <th className="px-4 py-2.5 text-right font-semibold">Множитель</th>
                <th className="px-4 py-2.5 text-right font-semibold sm:px-5">Выигрыш</th>
                <th className="px-4 py-2.5 text-right font-semibold sm:px-5">Когда</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((w, idx) => {
                const k = keyOf(w);
                const isFresh = freshKeys.has(k);
                const isTop = k === topKey;
                const game = GAME_LABEL[w.game] ?? GAME_LABEL.roulette;
                const details = detailsOf(w);
                return (
                  <tr
                    key={k}
                    className={[
                      'transition-colors duration-500',
                      isFresh ? 'bg-brand/10' : 'hover:bg-bg-card-hover',
                    ].join(' ')}
                  >
                    <td className="px-4 py-2.5 sm:px-5">
                      <div className="flex items-center gap-2.5">
                        {w.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={w.avatarUrl}
                            alt=""
                            className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-border"
                          />
                        ) : (
                          <span
                            aria-hidden
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${
                              AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length]
                            } text-[10px] font-bold text-text-primary ring-1 ring-border`}
                          >
                            {initials(w.username)}
                          </span>
                        )}
                        <span className="truncate font-medium text-text-primary">
                          {w.username}
                        </span>
                        {isTop && (
                          <span
                            title="Крупнейший выигрыш"
                            className="shrink-0 rounded bg-warning/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-warning"
                          >
                            топ
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${game.cls}`}
                      >
                        {game.label}
                      </span>
                      {details && (
                        <span className="ml-2 text-[11px] text-text-muted">{details}</span>
                      )}
                    </td>

                    <td
                      className={`px-4 py-2.5 text-right font-mono text-xs font-bold tabular-nums ${multiplierStyle(
                        w.multiplierBps,
                      )}`}
                    >
                      {typeof w.multiplierBps === 'number' && w.multiplierBps > 0
                        ? formatMultiplier(w.multiplierBps)
                        : '—'}
                    </td>

                    <td className="px-4 py-2.5 text-right font-mono font-bold tabular-nums text-brand sm:px-5">
                      {formatAzn(w.amountMinor)}
                    </td>

                    <td
                      className="px-4 py-2.5 text-right text-xs text-text-muted sm:px-5"
                      suppressHydrationWarning
                    >
                      {timeAgo(w.createdAt, now)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-border p-3 sm:px-5">
        <Link
          href={`${prefix}/roulette`}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-bg-elevated px-3 py-2.5 text-xs font-semibold text-text-secondary transition-colors hover:border-brand/40 hover:bg-brand/10 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          {t('viewAll')}
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}
