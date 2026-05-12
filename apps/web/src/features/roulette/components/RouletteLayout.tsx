'use client';

import { useEffect, useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Spinner, cn } from '@chcgreen/ui';
import { toast } from 'sonner';
import { RouletteWheel } from './RouletteWheel';
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

const COLOR_ORDER: RouletteColor[] = ['BLACK', 'RED', 'GREEN'];

const COLOR_ICON: Record<RouletteColor, string> = { BLACK: '♠', RED: '♦', GREEN: '★' };
const COLOR_FILL: Record<RouletteColor, string> = {
  BLACK: '#1a2035',
  RED: '#ff3b5c',
  GREEN: '#00ff88',
};
const COLOR_TEXT: Record<RouletteColor, string> = {
  BLACK: '#ffffff',
  RED: '#ffffff',
  GREEN: '#07090c',
};

// Безопасное чтение multiplier/totals, если поля ещё не пришли от бекенда
function safeMultiplier(round: RouletteRoundDto, color: RouletteColor): number {
  return round.multipliers?.[color] ?? (color === 'GREEN' ? 14 : 2);
}
function safeTotals(round: RouletteRoundDto, color: RouletteColor) {
  return round.totals?.[color] ?? { amountMinor: '0', betsCount: 0 };
}

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

  // Polling: текущее состояние раунда
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

  // Polling: история
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
    if (r.status === 'COMPLETED' && prevRound.current?.status !== 'COMPLETED') {
      if (r.winningColor) {
        const c = r.winningColor;
        const mul = r.multipliers?.[c] ?? (c === 'GREEN' ? 14 : 2);
        toast(`${COLOR_ICON[c]} Выпал ${c} ×${mul}!`, {
          duration: 5000,
          style: { background: COLOR_FILL[c], color: COLOR_TEXT[c], fontWeight: 700 },
        });
      }
    }
    prevRound.current = r;
  });

  if (loading) {
    return (
      <div className="flex justify-center py-20">
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

  const betsByColor: Record<RouletteColor, RouletteBetDto[]> = {
    BLACK: recentBets.filter((b) => b.color === 'BLACK'),
    RED: recentBets.filter((b) => b.color === 'RED'),
    GREEN: recentBets.filter((b) => b.color === 'GREEN'),
  };

  // Multipliers для BetPanel (с fallback)
  const safeMultipliers: Record<RouletteColor, number> = {
    BLACK: safeMultiplier(round, 'BLACK'),
    RED: safeMultiplier(round, 'RED'),
    GREEN: safeMultiplier(round, 'GREEN'),
  };

  return (
    <div className="space-y-4">
      {/* История раундов */}
      <HistoryStrip rounds={history} />

      {/* Основная панель колеса */}
      <div className="rounded-2xl border border-border bg-bg-card overflow-hidden">
        {/* Статистика */}
        <div className="flex items-center gap-4 px-4 pt-3 pb-2 text-xs text-text-muted border-b border-border/40">
          <span className="font-medium">Статистика ({history.length} раундов):</span>
          {COLOR_ORDER.map((c) => {
            const cnt = history.filter((r) => r.winningColor === c).length;
            const pct = history.length ? Math.round((cnt / history.length) * 100) : 0;
            return (
              <span key={c} className="flex items-center gap-1">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full border"
                  style={{ background: COLOR_FILL[c], borderColor: COLOR_FILL[c] + '80' }}
                />
                <span style={{ color: COLOR_FILL[c] }} className="font-semibold">{cnt}</span>
                <span className="text-text-muted">({pct}%)</span>
              </span>
            );
          })}
        </div>

        {/* Колесо */}
        <div className="flex justify-center py-6 px-4">
          <RouletteWheel winningSlot={round.winningSlot} status={round.status} />
        </div>

        {/* Таймер / статус */}
        <div className="border-t border-border px-4 py-3 text-center">
          {round.status === 'BETTING' && round.bettingEndsAt ? (
            <div>
              <div className="text-xs text-text-muted mb-0.5 uppercase tracking-widest">Принимаются ставки</div>
              <div className="text-4xl font-black tabular-nums text-brand">
                <CountdownTimer endsAt={round.bettingEndsAt} />
              </div>
            </div>
          ) : round.status === 'ROLLING' ? (
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-brand">
              <span className="animate-spin">⟳</span> Крутим колесо…
            </div>
          ) : round.status === 'COMPLETED' ? (
            <div className="text-sm font-semibold text-text-secondary">Следующий раунд скоро…</div>
          ) : (
            <div className="text-sm text-text-muted">Ожидаем раунд…</div>
          )}
        </div>
      </div>

      {/* Панель ставок */}
      {isAuthed && balance !== null ? (
        <BetPanel
          balanceMinor={balance}
          disabled={!canBet}
          multipliers={safeMultipliers}
        />
      ) : (
        <div className="rounded-2xl border border-border bg-bg-card p-4 text-sm text-text-secondary text-center">
          {t('loginToBet')}
        </div>
      )}

      {/* 3 колонки ставок по цвету */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {COLOR_ORDER.map((color) => {
          const bets = betsByColor[color];
          const totals = safeTotals(round, color);
          const mul = safeMultiplier(round, color);
          const fill = COLOR_FILL[color];
          const textColor = COLOR_TEXT[color];

          return (
            <div
              key={color}
              className="rounded-xl overflow-hidden border"
              style={{ borderColor: fill + '40', background: fill + '0d' }}
            >
              {/* Заголовок колонки */}
              <div
                className="flex items-center justify-between px-3 py-2.5"
                style={{ background: fill, color: textColor }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black">{COLOR_ICON[color]}</span>
                  <span className="text-sm font-bold">{color}</span>
                </div>
                <span className="text-base font-extrabold">×{mul}</span>
              </div>

              {/* Итоги */}
              <div
                className="flex items-center justify-between px-3 py-1.5 text-xs border-b"
                style={{ borderColor: fill + '30' }}
              >
                <span className="text-text-muted">{totals.betsCount} игроков</span>
                <span className="font-semibold text-text-secondary">
                  {(Number(totals.amountMinor) / 100).toFixed(2)} AZN
                </span>
              </div>

              {/* Список ставок */}
              <div className="divide-y divide-border/20 max-h-44 overflow-y-auto">
                {bets.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-text-muted">Ставок пока нет</div>
                ) : (
                  bets.slice(0, 12).map((b) => (
                    <div key={b.id} className="flex items-center justify-between px-3 py-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div
                          className="h-5 w-5 shrink-0 rounded-full flex items-center justify-center text-[9px] font-bold"
                          style={{ background: fill + '33', color: fill, border: `1px solid ${fill}55` }}
                        >
                          {(b.username ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate text-xs text-text-secondary">{b.username ?? 'Аноним'}</span>
                      </div>
                      <span className="tabular-nums text-xs font-semibold text-text-primary ml-2 shrink-0">
                        {(Number(b.amountMinor) / 100).toFixed(2)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
