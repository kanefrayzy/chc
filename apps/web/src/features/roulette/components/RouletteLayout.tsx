'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Spinner } from '@chcgreen/ui';
import { toast } from 'sonner';
import { RouletteWheel, ROULETTE_SPIN_MS } from './RouletteWheel';
import { BetPanel } from './BetPanel';
import { HistoryStrip } from './HistoryStrip';
import { CountdownTimer } from './CountdownTimer';
import { useUi } from '@/components/layout/ui-context';
import { CrownIcon } from '@/components/icons';
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

const COLOR_ORDER: RouletteColor[] = ['RED', 'GREEN', 'BLACK'];
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
  minBetMinor?: string;
  maxBetMinor?: string;
  iconGreen?: string;
  iconRed?: string;
  iconBlack?: string;
}

interface ResultInfo {
  roundId: string;
  slot: number;
  color: RouletteColor;
  multiplier: number;
}

export function RouletteLayout({ isAuthed, balanceMinor: initialBalance, minBetMinor, maxBetMinor, iconGreen, iconRed, iconBlack }: RouletteLayoutProps): JSX.Element {
  const t = useTranslations('roulette');
  const { refreshBalance } = useUi();
  const [round, setRound] = useState<RouletteRoundDto | null>(null);
  const [recentBets, setRecentBets] = useState<RouletteBetDto[]>([]);
  const [history, setHistory] = useState<RouletteRoundDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(initialBalance);
  const [myColors, setMyColors] = useState<RouletteColor[]>([]);
  // Последний разыгранный результат — живёт отдельно от round, не сбрасывается на BETTING.
  const [result, setResult] = useState<ResultInfo | null>(null);
  // Подсветка победителя на колесе (true только сразу после анимации; гаснет при новом раунде).
  const [highlightWinner, setHighlightWinner] = useState(false);

  const prevRoundIdRef = useRef<string | null>(null);
  const processedResultsRef = useRef<Set<string>>(new Set());
  // Раунды, для которых анимация уже была запущена из ROLLING-события.
  const processedRollingRef = useRef<Set<string>>(new Set());

  const reloadBalance = useCallback(async (): Promise<void> => {
    if (!isAuthed) return;
    try {
      const b = await walletApi.balance();
      setBalance(b.balanceMinor);
      refreshBalance();
    } catch { /* */ }
  }, [isAuthed, refreshBalance]);

  // При смене раунда — сбрасываем «свои цвета» и подсветку победителя.
  useEffect(() => {
    if (!round) return;
    if (prevRoundIdRef.current !== round.id) {
      prevRoundIdRef.current = round.id;
      setMyColors([]);
      setHighlightWinner(false);
    }
  }, [round]);

  // Подтянуть свои ставки в текущем раунде.
  useEffect(() => {
    if (!isAuthed || !round) return;
    let cancelled = false;
    (async () => {
      try {
        const mine = await rouletteApi.myBets(20);
        if (cancelled) return;
        const here = mine.items.filter((b) => b.roundId === round.id).map((b) => b.color);
        setMyColors(Array.from(new Set(here)));
      } catch { /* */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, round?.id]);

  // Хелпер: показать тост о результате раунда и обновить историю.
  const showRoundResult = useCallback((r: RouletteRoundDto): void => {
    const c = r.winningColor!;
    const mul = r.multipliers?.[c] ?? (c === 'GREEN' ? 14 : 2);
    setHighlightWinner(true);
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
              toast.success(`Победа! +${(Number(totalWin) / 100).toFixed(2)} AZN`, {
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
            return;
          }
        } catch { /* */ }
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
    rouletteApi.history(30).then((res) => setHistory(res.items)).catch(() => undefined);
  }, [isAuthed]);

  // Обрабатываем ROLLING-событие: сервер уже рассчитал winningSlot, клиент сразу крутит барабан.
  const handleRolling = useCallback((r: RouletteRoundDto) => {
    if (r.status !== 'ROLLING' || r.winningSlot === null || r.winningSlot === undefined || !r.winningColor) return;
    if (processedRollingRef.current.has(r.id)) return;
    processedRollingRef.current.add(r.id);

    const mul = r.multipliers?.[r.winningColor] ?? (r.winningColor === 'GREEN' ? 14 : 2);
    setResult({ roundId: r.id, slot: r.winningSlot, color: r.winningColor, multiplier: mul });
    // Подсвечиваем победную ячейку по окончании анимации.
    setTimeout(() => setHighlightWinner(true), ROULETTE_SPIN_MS + 200);
  }, []);

  // Обрабатываем COMPLETED-событие.
  // • Если анимация уже запущена из ROLLING → обновляем баланс + тост сразу (анимация закончилась).
  // • Если ROLLING-событие было пропущено (напр. перезагрузка страницы) → запускаем анимацию сейчас.
  const handleCompleted = useCallback((r: RouletteRoundDto) => {
    if (r.status !== 'COMPLETED' || r.winningSlot === null || r.winningSlot === undefined || !r.winningColor) return;
    if (processedResultsRef.current.has(r.id)) return;
    processedResultsRef.current.add(r.id);

    const animAlreadyDone = processedRollingRef.current.has(r.id);

    if (!animAlreadyDone) {
      // Пользователь пропустил ROLLING → запускаем анимацию сейчас, результат после неё.
      const mul = r.multipliers?.[r.winningColor] ?? (r.winningColor === 'GREEN' ? 14 : 2);
      setResult({ roundId: r.id, slot: r.winningSlot, color: r.winningColor, multiplier: mul });
      processedRollingRef.current.add(r.id);
      setTimeout(() => {
        showRoundResult(r);
        void reloadBalance();
      }, ROULETTE_SPIN_MS + 200);
    } else {
      // Анимация уже идёт / завершилась из ROLLING — показываем результат сразу.
      showRoundResult(r);
      void reloadBalance();
    }
  }, [showRoundResult, reloadBalance]);

  // ── polling: текущее состояние ──
  useEffect(() => {
    let cancelled = false;
    const pull = async (): Promise<void> => {
      try {
        const s = await rouletteApi.state();
        if (cancelled) return;
        setRound(s.round);
        setRecentBets(s.recentBets);
        if (s.round) {
          handleRolling(s.round);
          handleCompleted(s.round);
        }
      } catch { /* */ } finally {
        if (!cancelled) setLoading(false);
        if (!cancelled) setTimeout(pull, 2500);
      }
    };
    pull();
    return () => { cancelled = true; };
  }, [handleCompleted, handleRolling]);

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
    handleRolling(r);
    handleCompleted(r);
  });

  // Агрегируем ставки по (userId, color) — суммируем суммы и считаем количество.
  type Aggregated = {
    key: string;
    color: RouletteColor;
    username: string;
    amountMinor: bigint;
    count: number;
  };
  const aggregated = useMemo<Record<RouletteColor, Aggregated[]>>(() => {
    const acc: Record<string, Aggregated> = {};
    for (const b of recentBets) {
      const key = `${b.userId}|${b.color}`;
      if (!acc[key]) {
        acc[key] = {
          key,
          color: b.color,
          username: b.username ?? '—',
          amountMinor: 0n,
          count: 0,
        };
      }
      acc[key].amountMinor += BigInt(b.amountMinor);
      acc[key].count += 1;
    }
    const out: Record<RouletteColor, Aggregated[]> = { RED: [], GREEN: [], BLACK: [] };
    for (const v of Object.values(acc)) out[v.color].push(v);
    for (const c of COLOR_ORDER) {
      out[c].sort((a, b) => (a.amountMinor < b.amountMinor ? 1 : a.amountMinor > b.amountMinor ? -1 : 0));
    }
    return out;
  }, [recentBets]);

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

  const safeMultipliers: Record<RouletteColor, number> = {
    BLACK: safeMultiplier(round, 'BLACK'),
    RED: safeMultiplier(round, 'RED'),
    GREEN: safeMultiplier(round, 'GREEN'),
  };

  const totalBetsInRound =
    (round.totals?.RED.betsCount ?? 0) +
    (round.totals?.BLACK.betsCount ?? 0) +
    (round.totals?.GREEN.betsCount ?? 0);

  // ── Центр колеса ──
  const centerNode = (
    <div className="flex flex-col items-center justify-center text-center px-2">
      {round.status === 'BETTING' && totalBetsInRound === 0 ? (
        <>
          <span className="text-[10px] uppercase tracking-[0.25em] text-text-muted">Раунд</span>
          <span className="mt-1 text-sm font-bold text-text-secondary">Ожидание ставок</span>
          <span className="mt-0.5 text-[10px] text-text-muted">сделайте первую</span>
        </>
      ) : round.status === 'BETTING' && round.bettingEndsAt ? (
        <>
          <span className="text-[10px] uppercase tracking-[0.25em] text-text-muted">До закрытия</span>
          <span className="mt-1 font-black text-4xl sm:text-5xl tabular-nums text-brand drop-shadow-[0_0_12px_rgba(0,255,136,0.5)]">
            <CountdownTimer endsAt={round.bettingEndsAt} />
          </span>
        </>
      ) : round.status === 'ROLLING' ? (
        <>
          <span className="text-[10px] uppercase tracking-[0.25em] text-text-muted">Крутим</span>
          <span className="mt-1 text-3xl font-bold text-brand animate-pulse">…</span>
        </>
      ) : result && highlightWinner ? (
        <div
          className="flex flex-col items-center justify-center rounded-full px-4 py-2"
          style={{
            background: COLOR_FILL[result.color] + '22',
            border: `1px solid ${COLOR_FILL[result.color]}66`,
          }}
        >
          <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: COLOR_FILL[result.color] }}>
            Выпал
          </span>
          <span className="text-xl font-black" style={{ color: COLOR_FILL[result.color] }}>
            {result.color} ×{result.multiplier}
          </span>
        </div>
      ) : (
        <span className="text-xs text-text-muted">…</span>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <HistoryStrip rounds={history} />

      {/* Основная панель колеса. overflow-visible — чтобы тени и пин не обрезались. */}
      <div className="rounded-2xl border border-border bg-bg-card">
        <div className="flex items-center justify-end gap-2 px-4 pt-3 pb-1">
          <SoundToggle />
        </div>
        <div className="flex justify-center pb-6 pt-2 px-6 sm:px-8">
          <RouletteWheel
            resultRoundId={result?.roundId ?? null}
            resultSlot={result?.slot ?? null}
            resultColor={result?.color ?? null}
            highlightWinner={highlightWinner}
            center={centerNode}
            iconGreen={iconGreen}
            iconRed={iconRed}
            iconBlack={iconBlack}
          />
        </div>
      </div>

      {/* Панель ставок */}
      {isAuthed && balance !== null ? (
        <BetPanel
          balanceMinor={balance}
          disabled={!canBet}
          multipliers={safeMultipliers}
          minBetMinor={minBetMinor}
          maxBetMinor={maxBetMinor}
          placedColors={myColors}
          iconGreen={iconGreen}
          iconRed={iconRed}
          iconBlack={iconBlack}
          onBetPlaced={(color) => {
            setMyColors((prev) => (prev.includes(color) ? prev : [...prev, color]));
            void reloadBalance();
          }}
        />
      ) : (
        <div className="rounded-2xl border border-border bg-bg-card p-4 text-sm text-text-secondary text-center">
          {t('loginToBet')}
        </div>
      )}

      {/* 3 колонки: RED ─ GREEN ─ BLACK */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {COLOR_ORDER.map((color) => {
          const bets = aggregated[color];
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
                <span className="font-bold text-sm flex items-center gap-1">
                  {color === 'GREEN' ? <CrownIcon className="h-3.5 w-3.5" /> : null}
                  {color}
                </span>
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
                  bets.slice(0, 8).map((a) => (
                    <div key={a.key} className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="h-4 w-4 rounded-full shrink-0 flex items-center justify-center text-[8px] font-bold uppercase"
                          style={{ background: fill + '33', color: fill }}
                        >
                          {a.username.charAt(0)}
                        </span>
                        <span className="text-text-secondary truncate">
                          {a.username}
                        </span>
                        {a.count > 1 ? <span className="ml-1 text-text-muted shrink-0">×{a.count}</span> : null}
                      </span>
                      <span className="font-mono font-medium shrink-0 ml-2" style={{ color: fill }}>
                        {(Number(a.amountMinor) / 100).toFixed(2)}
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
