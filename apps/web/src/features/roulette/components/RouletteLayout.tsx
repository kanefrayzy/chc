'use client';

import { useEffect, useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Spinner } from '@chcgreen/ui';
import { toast } from 'sonner';
import { RouletteWheel, ColorTotalsBadge } from './RouletteWheel';
import { BetPanel } from './BetPanel';
import { HistoryStrip } from './HistoryStrip';
import { CountdownTimer } from './CountdownTimer';
import {
  rouletteApi,
  type RouletteBetDto,
  type RouletteColor,
  type RouletteRoundDto,
} from '@/lib/api/roulette';
import { useRouletteSocket } from '@/lib/realtime/useRouletteSocket';
import { cn } from '@chcgreen/ui';

const COLOR_ORDER: RouletteColor[] = ['BLACK', 'RED', 'GREEN'];
const COLOR_LABELS: Record<RouletteColor, string> = { BLACK: 'Black ×2', RED: 'Red ×2', GREEN: 'Green ×14' };
const COLOR_ICON: Record<RouletteColor, string> = { BLACK: '🦅', RED: '⚔️', GREEN: '💣' };
const COLOR_BG: Record<RouletteColor, string> = {
  BLACK: 'bg-[#141b2d] border-[#2a3350]',
  RED: 'bg-danger/10 border-danger/40',
  GREEN: 'bg-brand/10 border-brand/40',
};
const COLOR_HEADER_BG: Record<RouletteColor, string> = {
  BLACK: 'bg-[#1a2035]',
  RED: 'bg-danger',
  GREEN: 'bg-brand',
};
const COLOR_TEXT: Record<RouletteColor, string> = {
  BLACK: 'text-white',
  RED: 'text-white',
  GREEN: 'text-black',
};

export interface RouletteLayoutProps {
  isAuthed: boolean;
  balanceMinor: string | null;
  locale: string;
}

export function RouletteLayout({ isAuthed, balanceMinor: initialBalance }: RouletteLayoutProps): JSX.Element {
  const t = useTranslations('roulette');
  const [round, setRound] = useState<RouletteRoundDto | null>(null);
  const [recentBets, setRecentBets] = useState<RouletteBetDto[]>([]);
  const [history, setHistory] = useState<RouletteRoundDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(initialBalance);
  const prevRound = useRef<RouletteRoundDto | null>(null);

  // Polls
  useEffect(() => {
    let cancelled = false;
    const pull = async (): Promise<void> => {
      try {
        const s = await rouletteApi.state();
        if (cancelled) return;
        setRound(s.round);
        setRecentBets(s.recentBets);
      } catch { /* */ } finally {
        if (!cancelled) setLoading(false);
        if (!cancelled) setTimeout(pull, 2500);
      }
    };
    pull();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const pull = async (): Promise<void> => {
      try {
        const res = await rouletteApi.history(30);
        if (!cancelled) setHistory(res.items);
      } catch { /* */ } finally {
        if (!cancelled) setTimeout(pull, 15000);
      }
    };
    pull();
    return () => { cancelled = true; };
  }, []);

  // Real-time socket
  useRouletteSocket((r) => {
    setRound(r);
    // Уведомление о выигрыше
    if (r.status === 'COMPLETED' && prevRound.current?.status !== 'COMPLETED') {
      if (r.winningColor) {
        const emoji = COLOR_ICON[r.winningColor];
        toast(`${emoji} Раунд завершён! Выпал ${r.winningColor}`, { duration: 4000 });
      }
    }
    prevRound.current = r;
  });

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (!round) {
    return (
      <div className="rounded-2xl border border-border bg-bg-card p-8 text-center text-text-secondary">
        {t('noRound')}
      </div>
    );
  }

  const canBet = isAuthed && round.status === 'BETTING';

  // Ставки сгруппированные по цвету
  const betsByColor: Record<RouletteColor, RouletteBetDto[]> = {
    BLACK: recentBets.filter((b) => b.color === 'BLACK'),
    RED: recentBets.filter((b) => b.color === 'RED'),
    GREEN: recentBets.filter((b) => b.color === 'GREEN'),
  };

  return (
    <div className="space-y-4">
      {/* История раундов */}
      <HistoryStrip rounds={history} />

      {/* Колесо */}
      <div className="relative rounded-2xl border border-border bg-bg-card overflow-hidden">
        {/* Статистика сверху */}
        <div className="flex items-center gap-4 px-4 pt-3 pb-0 text-xs text-text-muted">
          <span>Статистика за {history.length}</span>
          {(['RED', 'GREEN', 'BLACK'] as RouletteColor[]).map((c) => {
            const cnt = history.filter((r) => r.winningColor === c).length;
            return (
              <span key={c} className="flex items-center gap-1">
                <span className={cn(
                  'inline-block w-2.5 h-2.5 rounded-full',
                  c === 'GREEN' ? 'bg-brand' : c === 'RED' ? 'bg-danger' : 'bg-bg-elevated border border-border',
                )} />
                {cnt}
              </span>
            );
          })}
        </div>

        <div className="px-4 pt-2 pb-4">
          <RouletteWheel winningSlot={round.winningSlot} status={round.status} />
        </div>

        {/* Таймер / статус */}
        <div className="border-t border-border px-4 py-3 text-center">
          {round.status === 'BETTING' && round.bettingEndsAt ? (
            <div>
              <div className="text-xs text-text-muted mb-0.5">Принимаются ставки</div>
              <div className="text-3xl font-bold tabular-nums text-text-primary">
                <CountdownTimer endsAt={round.bettingEndsAt} />
              </div>
            </div>
          ) : round.status === 'ROLLING' ? (
            <div className="text-sm font-semibold text-brand animate-pulse">⟳ Крутим колесо…</div>
          ) : round.status === 'COMPLETED' ? (
            <div className="text-sm font-semibold text-text-secondary">Раунд завершён</div>
          ) : (
            <div className="text-sm text-text-muted">Ожидаем следующий раунд…</div>
          )}
        </div>
      </div>

      {/* BetPanel */}
      {isAuthed && balance !== null ? (
        <BetPanel
          balanceMinor={balance}
          disabled={!canBet}
          multipliers={round.multipliers}
        />
      ) : (
        <div className="rounded-2xl border border-border bg-bg-card p-4 text-sm text-text-secondary text-center">
          {t('loginToBet')}
        </div>
      )}

      {/* Ставки по 4 колонкам (как на скриншоте: BLACK RED GREEN + JOKER) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(COLOR_ORDER as RouletteColor[]).map((color) => {
          const bets = betsByColor[color];
          const totals = round.totals[color];
          return (
            <div key={color} className={cn('rounded-xl border overflow-hidden', COLOR_BG[color])}>
              {/* Заголовок */}
              <div className={cn('flex items-center justify-between px-3 py-2', COLOR_HEADER_BG[color], COLOR_TEXT[color])}>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{COLOR_ICON[color]}</span>
                  <span className="text-xs font-bold">Place a bet</span>
                </div>
                <span className="text-sm font-extrabold">×{round.multipliers[color]}</span>
              </div>
              {/* Итоги */}
              <div className="flex items-center justify-between px-3 py-1.5 text-xs text-text-muted border-b border-border/50">
                <span>игроков: {totals.betsCount}</span>
                <span className="font-semibold text-text-secondary">{(Number(totals.amountMinor) / 100).toFixed(2)}</span>
              </div>
              {/* Список ставок */}
              <div className="divide-y divide-border/30 max-h-48 overflow-y-auto">
                {bets.length === 0 ? (
                  <div className="px-3 py-3 text-center text-xs text-text-muted">—</div>
                ) : (
                  bets.slice(0, 10).map((b) => (
                    <div key={b.id} className="flex items-center justify-between px-3 py-1.5 text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="h-5 w-5 rounded-full bg-bg-elevated border border-border shrink-0 flex items-center justify-center text-[9px] font-bold text-text-muted">
                          {(b.username ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate text-text-secondary">{b.username ?? 'Аноним'}</span>
                      </div>
                      <span className="tabular-nums font-semibold text-text-primary shrink-0 ml-1">
                        {(Number(b.amountMinor) / 100).toFixed(2)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
        {/* 4-я колонка — джокер (задел на будущее) */}
        <div className="rounded-xl border border-[#2a3350] overflow-hidden bg-[#0d1120] opacity-60">
          <div className="flex items-center justify-between px-3 py-2 bg-[#1a1f3a] text-text-muted">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">🃏</span>
              <span className="text-xs font-bold">Jackpot</span>
            </div>
            <span className="text-sm font-extrabold">×7</span>
          </div>
          <div className="px-3 py-3 text-center text-xs text-text-muted">Скоро</div>
        </div>
      </div>
    </div>
  );
}
