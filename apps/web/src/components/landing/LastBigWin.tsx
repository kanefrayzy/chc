'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ArrowRightIcon, TrophyIcon } from '@/components/icons';
import { rouletteApi, type RecentWinnerDto } from '@/lib/api/roulette';
import { getRealtimeSocket } from '@/lib/realtime/socket';
import { localePrefix } from '@/lib/i18n/prefix';

/** Сколько последних записей просматриваем в поисках самой крупной. */
const SCAN_LIMIT = 15;

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** «только что», «5 мин», «2 ч» — подписи берутся из файлов локализации. */
function timeAgo(iso: string, now: number, t: Translate): string {
  const diffSec = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return t('justNow');
  const min = Math.floor(diffSec / 60);
  if (min < 60) return t('minutes', { n: min });
  const hours = Math.floor(min / 60);
  if (hours < 24) return t('hours', { n: hours });
  return t('days', { n: Math.floor(hours / 24) });
}

function formatWhole(minor: string): string {
  return (BigInt(minor) / 100n).toLocaleString('ru-RU');
}

export interface LastBigWinProps {
  locale: string;
}

/**
 * Витрина самого крупного выигрыша из последней ленты. Данные те же, что и в
 * общем списке победителей, поэтому баннер всегда согласован с лентой ниже.
 */
export function LastBigWin({ locale }: LastBigWinProps): JSX.Element | null {
  const t = useTranslations('jackpot');
  const tt = useTranslations('winnersTable');
  const [winners, setWinners] = useState<RecentWinnerDto[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const prefix = localePrefix(locale);

  useEffect(() => {
    let cancelled = false;

    rouletteApi
      .recentWinners(SCAN_LIMIT)
      .then((r) => {
        if (!cancelled) setWinners(r.items);
      })
      .catch(() => undefined);

    const socket = getRealtimeSocket();
    const handler = (payload: { items?: RecentWinnerDto[] }): void => {
      if (Array.isArray(payload?.items)) setWinners(payload.items);
    };
    socket.on('roulette:winners', handler);

    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      cancelled = true;
      socket.off('roulette:winners', handler);
      clearInterval(timer);
    };
  }, []);

  const top = useMemo(() => {
    let best: RecentWinnerDto | null = null;
    for (const w of winners) {
      if (!best || BigInt(w.amountMinor) > BigInt(best.amountMinor)) best = w;
    }
    return best;
  }, [winners]);

  if (!top) return null;

  return (
    <Link
      href={`${prefix}/roulette`}
      className="group mt-4 flex items-center gap-3 rounded-2xl border border-warning/25 bg-gradient-to-r from-warning/10 via-bg-card to-bg-card px-4 py-3 transition-colors hover:border-warning/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning/40"
    >
      <span
        aria-hidden
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning ring-1 ring-warning/30"
      >
        <TrophyIcon className="h-5 w-5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand">
          {t('lastBigWin')}
        </p>
        <p className="truncate text-sm text-text-secondary">
          <span className="font-semibold text-text-primary">{top.username}</span> {t('won')}
        </p>
        <p className="font-mono text-xl font-black tabular-nums text-warning sm:text-2xl">
          {formatWhole(top.amountMinor)}{' '}
          <span className="text-sm font-bold">AZN</span>
        </p>
      </div>

      <div className="shrink-0 text-right">
        <span className="block text-[11px] text-text-muted" suppressHydrationWarning>
          {timeAgo(top.createdAt, now, tt)}
        </span>
        <ArrowRightIcon className="ml-auto mt-1 h-4 w-4 text-text-muted transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
