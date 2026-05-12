'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Spinner } from '@chcgreen/ui';
import { toast } from 'sonner';
import { RouletteWheel } from './RouletteWheel';
import { BetPanel } from './BetPanel';
import { HistoryStrip } from './HistoryStrip';
import { CountdownTimer } from './CountdownTimer';
import { useUi } from '@/components/layout/ui-context';
import {
  rouletteApi,
  type RouletteBetDto,
  type RouletteColor,
  type RouletteRoundDto,
} from '@/lib/api/roulette';
import { walletApi } from '@/lib/api/wallet';
import { useRouletteSocket } from '@/lib/realtime/useRouletteSocket';
import { playWin, playLose } from '@/lib/sound';
import { SoundToggle } from './SoundToggle';

const COLOR_ORDER: RouletteColor[] = ['BLACK', 'RED', 'GREEN'];
const COLOR_FILL: Record<RouletteColor, string> = {
  BLACK: '#2a3344',
  RED: '#ff3b5c',
  GREEN: '#00ff88',
};
const COLOR_TEXT: Record<RouletteColor, string> = {
  BLACK: '#ffffff',
  RED: '#ffffff',
  GREEN: '#07090c',
};

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
  const { refreshBalance } = useUi();
  const [round, setRound] = useState<RouletteRoundDto | null>(null);
  const [recentBets, setRecentBets] = useState<RouletteBetDto[]>([]);
  const [history, setHistory] = useState<RouletteRoundDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(initialBalance);
  const prevRound = useRef<RouletteRoundDto | null>(null);

  const reloadBalance = useCallback(async (): Promise<void> => {
    if (!isAuthed) return;
    try {
      const b = await walletApi.balance();
      setBalance(b.balanceMinor);
      refreshBalance();
    } catch { /* */ }
  }, [isAuthed, refreshBalance]);

  // ── polling: текущее состояние ──
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

  // ── polling: история ──
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

  // ── real-time ──
  useRouletteSocket((r) => {
    setRound(r);
    if (r.status === 'COMPLETED' && prevRound.current?.status !== 'COMPLETED') {
      if (r.winningColor) {
        const c = r.winningColor;
        const mul = r.multipliers?.[c] ?? (c === 'GREEN' ? 14 : 2);

        // Запросим свои ставки в этом раунде, чтобы посчитать итог
        if (isAuthed) {
          void (async () => {
            try {
              const mine = await rouletteApi.myBets(20);
              const myBets = mine.items.filter((b) => b.roundId === r.id);
              if (myBets.length > 0) {
                const totalBet = myBets.reduce((s, b) => s + BigInt(b.amountMinor), 0n);
                const totalWin = myBets
                  .filter((b) => b.color === c)
                  .reduce((s, b) => s + BigInt(b.amountMinor) * BigInt(mul), 0n);
                const net = totalWin - totalBet;
                if (totalWin > 0n) {
                  toast.success(`🎉 Победа! +${(Number(net) / 100).toFixed(2)} AZN`, {
                    duration: 6000,
                    style: {
                      background: COLOR_FILL[c],
                      color: COLOR_TEXT[c],
                      fontWeight: 700,
                      boxShadow: `0 0 28px ${COLOR_FILL[c]}80`,
                    },
                  });
                  playWin();
                } else {
                  toast.error(`Не повезло — ${(Number(totalBet) / 100).toFixed(2)} AZN ушло`, { duration: 5000 });
                  playLose();
                }
                void reloadBalance();
                return;
              }
            } catch { /* */ }
            // если своих ставок нет — просто показываем результат
            toast(`Выпал ${c} ×${mul}`, {
              duration: 4000,
              style: { background: COLOR_FILL[c], color: COLOR_TEXT[c], fontWeight: 700 },
            });
          })();
        } else {
          toast(`Выпал ${c} ×${mul}`, {
            duration: 4000,
            style: { background: COLOR_FILL[c], color: COLOR_TEXT[c], fontWeight: 700 },
          });
        }
      }
    }
    prevRound.current = r;
  });

  // когда пользователь делает ставку — обновляем баланс

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

  const safeMultipliers: Record<RouletteColor, number> = {
    BLACK: safeMultiplier(round, 'BLACK'),
    RED: safeMultiplier(round, 'RED'),
    GREEN: safeMultiplier(round, 'GREEN'),
  };

  // Центр колеса: таймер / статус / результат
  const centerNode = (
    <div className="flex flex-col items-center justify-center text-center">
      {round.status === 'BETTING' && round.bettingEndsAt ? (
        <>
          <span className="text-[10px] uppercase tracking-[0.25em] text-text-muted">
            Принимаются ставки
          </span>
          <span className="mt-1 font-black text-4xl sm:text-5xl tabular-nums text-brand drop-shadow-[0_0_12px_rgba(0,255,136,0.5)]">
            <CountdownTimer endsAt={round.bettingEndsAt} />
          </span>
        </>
      ) : round.status === 'ROLLING' ? (
        <>
          <span className="text-[10px] uppercase tracking-[0.25em] text-text-muted">Крутим</span>
          <span className="mt-1 text-3xl font-bold text-brand animate-pulse">…</span>
        </>
      ) : round.status === 'COMPLETED' && round.winningColor ? (
        <div
          className="flex flex-col items-center justify-center rounded-full px-4 py-2"
          style={{
            background: COLOR_FILL[round.winningColor] + '22',
            border: `1px solid ${COLOR_FILL[round.winningColor]}66`,
          }}
        >
          <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: COLOR_FILL[round.winningColor] }}>
            Выпал
          </span>
          <span className="text-xl font-black" style={{ color: COLOR_FILL[round.winningColor] }}>
            {round.winningColor} ×{safeMultipliers[round.winningColor]}
          </span>
        </div>
      ) : (
        <span className="text-xs text-text-muted">Раунд начнётся скоро…</span>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* История раундов */}
      <HistoryStrip rounds={history} />

      {/* Основная панель колеса */}
      <div className="rounded-2xl border border-border bg-bg-card overflow-hidden">
        {/* Статистика */}
        <div className="flex items-center justify-between gap-4 px-4 pt-3 pb-2 text-xs text-text-muted border-b border-border/40">
          <div className="flex items-center gap-4">
            <span className="font-medium">Статистика ({history.length}):</span>
            {COLOR_ORDER.map((c) => {
              const cnt = history.filter((r) => r.winningColor === c).length;
              const pct = history.length ? Math.round((cnt / history.length) * 100) : 0;
              return (
                <span key={c} className="flex items-center gap-1">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ background: COLOR_FILL[c], boxShadow: `0 0 8px ${COLOR_FILL[c]}60` }}
                  />
                  <span style={{ color: COLOR_FILL[c] }} className="font-semibold">{cnt}</span>
                  <span className="text-text-muted">({pct}%)</span>
                </span>
              );
            })}
          </div>
          <SoundToggle />
        </div>

        {/* Колесо */}
        <div className="flex justify-center py-4 px-4">
          <RouletteWheel
            winningSlot={round.winningSlot}
            status={round.status}
            center={centerNode}
          />
        </div>
      </div>

      {/* Панель ставок */}
      {isAuthed && balance !== null ? (
        <BetPanel
          balanceMinor={balance}
          disabled={!canBet}
          multipliers={safeMultipliers}
          onBetPlaced={() => { void reloadBalance(); }}
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
              <div className="flex items-center justify-between px-3 py-2" style={{ background: fill, color: textColor }}>
                <span className="font-bold text-sm">{color}</span>
                <span className="font-mono text-xs opacity-90">×{mul}</span>
              </div>
              <div className="px-3 py-2 flex items-center justify-between text-xs">
                <span className="text-text-muted">{totals.betsCount} ставок</span>
                <span className="font-mono font-semibold text-text-primary">
                  {(Number(totals.amountMinor) / 100).toFixed(2)} AZN
                </span>
              </div>
              <div className="px-3 pb-3 max-h-32 overflow-y-auto space-y-1">
                {bets.length === 0 ? (
                  <div className="text-[11px] text-text-muted italic">Ставок пока нет</div>
                ) : (
                  bets.slice(0, 6).map((b) => (
                    <div key={b.id} className="flex items-center justify-between text-[11px]">
                      <span className="text-text-secondary truncate max-w-[70%]">{b.username ?? '—'}</span>
                      <span className="font-mono font-medium" style={{ color: fill }}>
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
