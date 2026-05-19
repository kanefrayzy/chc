'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRightIcon, TrophyIcon } from '@/components/icons';
import { rouletteApi, type RecentWinnerDto } from '@/lib/api/roulette';
import { getRealtimeSocket } from '@/lib/realtime/socket';
import { formatMinorAmount } from '@/lib/format/money';

export interface RecentWinnersProps {
  locale: string;
}

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

export function RecentWinners({ locale }: RecentWinnersProps): JSX.Element {
  const t = useTranslations('winners');
  const [winners, setWinners] = useState<RecentWinnerDto[]>([]);
  const localePrefix = locale === 'ru' ? '' : `/${locale}`;

  useEffect(() => {
    let cancelled = false;
    rouletteApi
      .recentWinners(5)
      .then((res) => {
        if (!cancelled) setWinners(res.items);
      })
      .catch(() => {
        if (!cancelled) setWinners([]);
      });

    const socket = getRealtimeSocket();
    const handler = (payload: { items: RecentWinnerDto[] }): void => {
      if (!cancelled && Array.isArray(payload?.items)) {
        setWinners(payload.items.slice(0, 5));
      }
    };
    socket.on('roulette:winners', handler);

    return () => {
      cancelled = true;
      socket.off('roulette:winners', handler);
    };
  }, []);

  const fmtLocale: 'ru' | 'az' | 'en' =
    locale === 'az' ? 'az' : locale === 'en' ? 'en' : 'ru';

  return (
    <aside
      aria-labelledby="recent-winners-title"
      className="rounded-2xl border border-border bg-bg-card p-4 sm:p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3
          id="recent-winners-title"
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-secondary"
        >
          <TrophyIcon className="h-4 w-4 text-brand" />
          {t('title')}
        </h3>
      </div>
      {winners.length === 0 ? (
        <div className="py-10 text-center text-sm text-text-muted">{t('empty')}</div>
      ) : (
        <ul className="space-y-2.5">
          {winners.map((w, idx) => (
            <li
              key={`${w.username}-${w.createdAt}-${idx}`}
              className="flex items-center gap-3 rounded-lg px-1.5 py-1 transition-colors hover:bg-bg-card-hover"
            >
              {w.avatarUrl ? (
                <img
                  src={w.avatarUrl}
                  alt={w.username}
                  className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-border"
                />
              ) : (
                <span
                  aria-hidden
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${
                    AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length]
                  } text-[11px] font-bold text-text-primary ring-1 ring-border`}
                >
                  {initials(w.username)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-text-primary">
                  {w.username}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                  {w.game === 'mines' ? (
                    <>
                      <span className="rounded bg-accent-purple/15 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-accent-purple">
                        Mines
                      </span>
                      {typeof w.multiplierBps === 'number' ? (
                        <span className="font-mono">×{(w.multiplierBps / 10000).toFixed(2)}</span>
                      ) : null}
                      {typeof w.mineCount === 'number' ? (
                        <span>· {w.mineCount} 💣</span>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <span className="rounded bg-brand/15 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-brand">
                        Roulette
                      </span>
                      {w.color ? <span>{w.color}</span> : null}
                    </>
                  )}
                </div>
              </div>
              <div className="shrink-0 font-mono text-sm font-bold tabular-nums text-brand">
                {formatMinorAmount(w.amountMinor, {
                  locale: fmtLocale,
                  showPositiveSign: false,
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Link
        href={`${localePrefix}/roulette`}
        className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-bg-elevated px-3 py-2 text-xs font-semibold text-text-secondary transition-colors hover:border-brand/40 hover:bg-brand/10 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        {t('viewAll')}
        <ArrowRightIcon className="h-3.5 w-3.5" />
      </Link>
    </aside>
  );
}
