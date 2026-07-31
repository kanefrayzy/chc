'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Spinner } from '@chcgreen/ui';
import { MinesGrid } from './MinesGrid';
import { MinesControls, type MinesMode, type MinesAutoConfig } from './MinesControls';
import { MinesHistory } from './MinesHistory';
import { MinesInfoModal } from './MinesInfoModal';
import { minesApi, type MinesGameDto, type MinesLimitsDto } from '@/lib/api/mines';
import { walletApi } from '@/lib/api/wallet';
import { useMinesSocket } from '@/lib/realtime/useMinesSocket';
import { useUi } from '@/components/layout/ui-context';
import { ApiException } from '@/lib/api/client';
import { parseAmountToMinor } from '@/features/wallet/components/AmountField';
import { playWin, playLose, playClick } from '@/lib/sound';

export interface MinesLayoutProps {
  isAuthed: boolean;
  balanceMinor: string | null;
  /** Лимиты, прокинутые из RSC (резервный fallback). */
  defaultLimits?: MinesLimitsDto;
  /** Кастомная иконка кристалла (URL). Пусто — встроенный SVG. */
  gemIconUrl?: string;
  /** Кастомная иконка бомбы (URL). Пусто — встроенный SVG. */
  bombIconUrl?: string;
}

const DEFAULT_LIMITS: MinesLimitsDto = {
  minBetMinor: '100',
  maxBetMinor: '100000',
  minMines: 1,
  maxMines: 24,
  totalTiles: 25,
};

export function MinesLayout({ isAuthed, balanceMinor: initialBalance, defaultLimits, gemIconUrl, bombIconUrl }: MinesLayoutProps): JSX.Element {
  const t = useTranslations('mines');
  const { refreshBalance } = useUi();
  const [balance, setBalance] = useState<string | null>(initialBalance);
  const [limits, setLimits] = useState<MinesLimitsDto>(defaultLimits ?? DEFAULT_LIMITS);
  const [game, setGame] = useState<MinesGameDto | null>(null);
  const [history, setHistory] = useState<MinesGameDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState<string>('1.00');
  const [mineCount, setMineCount] = useState<number>(3);
  const [pendingTile, setPendingTile] = useState<number | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);

  // Авто-режим
  const [mode, setMode] = useState<MinesMode>('manual');
  const [autoConfig, setAutoConfig] = useState<MinesAutoConfig>({
    betsCount: 0,
    onWin: 'reset',
    winPct: 0,
    onLoss: 'reset',
    lossPct: 0,
    stopWinAmount: '0',
    stopLossAmount: '0',
  });
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoRoundsDone, setAutoRoundsDone] = useState(0);
  const [autoSelectedTiles, setAutoSelectedTiles] = useState<number[]>([]);
  const autoRunningRef = useRef(false);

  const prevStatusRef = useRef<string | null>(null);
  const bustedTile = useMemo<number | null>(() => {
    if (!game || game.status !== 'BUSTED') return null;
    // Последняя клетка, которую пытался открыть игрок — она не входит в revealedTiles,
    // но входит в minePositions; на бэке мы её знаем как pendingTile.
    return pendingTile;
  }, [game, pendingTile]);

  const reloadBalance = useCallback(async (): Promise<void> => {
    if (!isAuthed) return;
    try {
      const b = await walletApi.balance();
      setBalance(b.balanceMinor);
      refreshBalance();
    } catch { /* ignore */ }
  }, [isAuthed, refreshBalance]);

  // Первичная загрузка: лимиты + текущее состояние + история.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [limitsRes, stateRes, histRes] = await Promise.all([
          minesApi.limits(),
          isAuthed ? minesApi.state() : Promise.resolve({ game: null }),
          isAuthed ? minesApi.history(30) : Promise.resolve({ items: [] as MinesGameDto[] }),
        ]);
        if (cancelled) return;
        setLimits(limitsRes);
        // Показываем только активную игру; завершённые остаются в истории и не блокируют поле.
        setGame(stateRes.game && stateRes.game.status === 'ACTIVE' ? stateRes.game : null);
        setHistory(histRes.items);
        if (stateRes.game?.status === 'ACTIVE' && stateRes.game.mineCount) setMineCount(stateRes.game.mineCount);
      } catch (e) {
        if (!cancelled) toast.error(t('errors.loadFailed'));
        // eslint-disable-next-line no-console
        console.error('mines: initial load failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthed, t]);

  // WS: реагируем на обновления состояния от сервера.
  useMinesSocket((g) => {
    setGame((prev) => {
      // Игнорируем устаревшие события.
      if (prev && prev.id === g.id && prev.status !== 'ACTIVE' && g.status === 'ACTIVE') return prev;
      return g;
    });
  });

  // Финализация: тосты, история, баланс при смене статуса.
  useEffect(() => {
    if (!game) {
      prevStatusRef.current = null;
      return;
    }
    const prev = prevStatusRef.current;
    if (prev !== game.status) {
      if (game.status === 'CASHED_OUT' && prev === 'ACTIVE') {
        const win = Number(game.payoutMinor) / 100;
        toast.success(t('toast.cashedOut', { amount: win.toFixed(2) }));
        playWin();
        void reloadBalance();
        void refreshHistory();
      } else if (game.status === 'BUSTED' && prev === 'ACTIVE') {
        const bet = Number(game.betMinor) / 100;
        toast.error(t('toast.busted', { amount: bet.toFixed(2) }));
        playLose();
        void reloadBalance();
        void refreshHistory();
      }
      prevStatusRef.current = game.status;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.status]);

  const refreshHistory = useCallback(async (): Promise<void> => {
    if (!isAuthed) return;
    try {
      const r = await minesApi.history(30);
      setHistory(r.items);
    } catch { /* ignore */ }
  }, [isAuthed]);

  const handleStart = useCallback(async (): Promise<void> => {
    if (!isAuthed) return;
    const minor = parseAmountToMinor(amount);
    if (minor === null) {
      toast.error(t('errors.invalidAmount'));
      return;
    }
    setBusy(true);
    setPendingTile(null);
    try {
      const g = await minesApi.start({ amountMinor: minor.toString(), mineCount });
      setGame(g);
      playClick();
      await reloadBalance();
    } catch (e) {
      handleApiError(e, t);
    } finally {
      setBusy(false);
    }
  }, [isAuthed, amount, mineCount, t, reloadBalance]);

  const handleReveal = useCallback(async (tile: number): Promise<void> => {
    if (!game || game.status !== 'ACTIVE' || busy) return;
    setBusy(true);
    setPendingTile(tile);
    try {
      const g = await minesApi.reveal(tile);
      setGame(g);
      if (g.status === 'ACTIVE') playClick();
      // pendingTile сбрасываем только для активной игры — для BUSTED оставляем,
      // чтобы подсветить именно ту клетку, на которой игрок взорвался.
      if (g.status !== 'BUSTED') setPendingTile(null);
    } catch (e) {
      setPendingTile(null);
      handleApiError(e, t);
    } finally {
      setBusy(false);
    }
  }, [game, busy, t]);

  const handleCashout = useCallback(async (): Promise<void> => {
    if (!game || game.status !== 'ACTIVE' || busy) return;
    setBusy(true);
    try {
      const g = await minesApi.cashout();
      setGame(g);
    } catch (e) {
      handleApiError(e, t);
    } finally {
      setBusy(false);
    }
  }, [game, busy, t]);

  // ───────────── Авто-режим ─────────────
  const handleAutoStop = useCallback((): void => {
    autoRunningRef.current = false;
  }, []);

  const handleAutoToggleSelect = useCallback((tile: number): void => {
    setAutoSelectedTiles((prev) => {
      if (prev.includes(tile)) return prev.filter((t) => t !== tile);
      // Не даём выбрать больше, чем безопасных клеток.
      const safeTotal = Math.max(1, limits.totalTiles - mineCount);
      if (prev.length >= safeTotal) return prev;
      return [...prev, tile];
    });
  }, [limits.totalTiles, mineCount]);

  const handleAutoSelectionClear = useCallback((): void => {
    setAutoSelectedTiles([]);
  }, []);

  // Если меняется количество мин — обрезаем выбор до допустимого размера.
  useEffect(() => {
    const safeTotal = Math.max(1, limits.totalTiles - mineCount);
    setAutoSelectedTiles((prev) => (prev.length > safeTotal ? prev.slice(0, safeTotal) : prev));
  }, [mineCount, limits.totalTiles]);

  const handleAutoStart = useCallback(async (): Promise<void> => {
    if (autoRunningRef.current) return;
    if (!isAuthed) return;
    if (autoSelectedTiles.length === 0) {
      toast.error(t('errors.noSelection'));
      return;
    }
    const baseBet = parseAmountToMinor(amount);
    if (baseBet === null) {
      toast.error(t('errors.invalidAmount'));
      return;
    }
    autoRunningRef.current = true;
    setAutoRunning(true);
    setAutoRoundsDone(0);

    const minBetLocal = BigInt(limits.minBetMinor);
    const maxBetLocal = BigInt(limits.maxBetMinor);
    const safeTotal = Math.max(1, limits.totalTiles - mineCount);
    // Берём «снимок» выбранных клеток — даже если пользователь что-то трогнёт во время цикла.
    const tilesPlan = autoSelectedTiles.slice(0, safeTotal);
    const stopWinMinor = (() => {
      const v = parseAmountToMinor(autoConfig.stopWinAmount || '0');
      return v && v > 0n ? v : 0n;
    })();
    const stopLossMinor = (() => {
      const v = parseAmountToMinor(autoConfig.stopLossAmount || '0');
      return v && v > 0n ? v : 0n;
    })();

    let curBet = baseBet;
    let profit = 0n;
    let rounds = 0;

    try {
      while (
        autoRunningRef.current &&
        (autoConfig.betsCount === 0 || rounds < autoConfig.betsCount)
      ) {
        if (curBet < minBetLocal) curBet = minBetLocal;
        if (curBet > maxBetLocal) curBet = maxBetLocal;

        // Старт раунда
        let g: MinesGameDto;
        try {
          g = await minesApi.start({ amountMinor: curBet.toString(), mineCount });
        } catch (e) {
          handleApiError(e, t);
          break;
        }
        setGame(g);
        setPendingTile(null);
        playClick();

        // Открываем заранее выбранные клетки в их порядке (мгновенно, без задержек между раскрытиями)
        for (const tile of tilesPlan) {
          if (!autoRunningRef.current) break;
          if (g.status !== 'ACTIVE') break;
          if (g.revealedTiles.includes(tile)) continue;
          setPendingTile(tile);
          try {
            g = await minesApi.reveal(tile);
          } catch (e) {
            handleApiError(e, t);
            autoRunningRef.current = false;
            break;
          }
          setGame(g);
          if (g.status !== 'ACTIVE') break;
        }

        // Cashout если ещё активна и план отработан
        if (autoRunningRef.current && g.status === 'ACTIVE') {
          try {
            g = await minesApi.cashout();
            setGame(g);
          } catch (e) {
            handleApiError(e, t);
            autoRunningRef.current = false;
            break;
          }
        }

        const won = g.status === 'CASHED_OUT';
        const bet = BigInt(g.betMinor);
        const payout = BigInt(g.payoutMinor);
        profit += won ? payout - bet : -bet;
        rounds += 1;
        setAutoRoundsDone(rounds);
        void reloadBalance();
        void refreshHistory();

        // Стопы по суммарной прибыли/убытку
        if (stopWinMinor > 0n && profit >= stopWinMinor) break;
        if (stopLossMinor > 0n && profit <= -stopLossMinor) break;

        // Корректировка следующей ставки
        if (won) {
          if (autoConfig.onWin === 'reset') {
            curBet = baseBet;
          } else {
            const inc = (curBet * BigInt(Math.round(autoConfig.winPct * 100))) / 10000n;
            curBet = curBet + inc;
          }
        } else if (autoConfig.onLoss === 'reset') {
          curBet = baseBet;
        } else {
          const inc = (curBet * BigInt(Math.round(autoConfig.lossPct * 100))) / 10000n;
          curBet = curBet + inc;
        }
        setAmount((Number(curBet) / 100).toFixed(2));

        if (!autoRunningRef.current) break;
        // Короткая пауза, чтобы игрок успел заметить исход, затем очищаем поле под следующий раунд
        await sleep(550);
        setGame(null);
        setPendingTile(null);
      }
    } finally {
      autoRunningRef.current = false;
      setAutoRunning(false);
      setPendingTile(null);
      setGame(null);
    }
  }, [
    isAuthed,
    amount,
    mineCount,
    limits.minBetMinor,
    limits.maxBetMinor,
    limits.totalTiles,
    autoConfig,
    autoSelectedTiles,
    t,
    reloadBalance,
    refreshHistory,
  ]);

  // Останавливаем авто-цикл при размонтировании.
  useEffect(() => {
    return () => {
      autoRunningRef.current = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const isGameActive = game?.status === 'ACTIVE';
  const minBet = BigInt(limits.minBetMinor);
  const maxBet = BigInt(limits.maxBetMinor);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-text-primary sm:text-2xl">{t('pageTitle')}</h1>
        </div>
        <button
          type="button"
          onClick={() => setInfoOpen(true)}
          className="rounded-full border border-border bg-bg-card px-3 py-1.5 text-xs font-semibold text-text-secondary hover:border-brand hover:text-brand"
        >
          {t('infoButton')}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-bg-card p-3 sm:p-5">
          {/* Игровая статусная полоса (всегда рендерится — иначе лейаут прыгает между раундами в авторежиме) */}
          <div className="flex w-full max-w-[640px] items-center justify-between rounded-lg border border-border bg-bg-elevated px-3 py-2 text-xs">
            {game ? (
              <>
                <span className="text-text-muted">
                  {t('status.label')}:{' '}
                  <span className="font-semibold text-text-primary">{t(`status.${game.status}`)}</span>
                </span>
                <span className="font-mono text-text-muted">
                  {t('status.opened', { count: game.revealedTiles.length, total: limits.totalTiles - game.mineCount })}
                </span>
              </>
            ) : (
              <>
                <span className="text-text-muted">
                  {t('status.label')}: <span className="font-semibold text-text-secondary">—</span>
                </span>
                <span className="font-mono text-text-muted">
                  {t('status.opened', { count: 0, total: Math.max(1, limits.totalTiles - mineCount) })}
                </span>
              </>
            )}
          </div>

          <MinesGrid
            game={game}
            totalTiles={limits.totalTiles}
            gridSize={Math.sqrt(limits.totalTiles)}
            pendingTile={pendingTile}
            disabled={!isAuthed || !isGameActive || busy}
            onReveal={handleReveal}
            bustedTile={bustedTile}
            gemIconUrl={gemIconUrl}
            bombIconUrl={bombIconUrl}
            selectionMode={mode === 'auto'}
            selectedTiles={autoSelectedTiles}
            onToggleSelect={mode === 'auto' && !isGameActive && !autoRunning ? handleAutoToggleSelect : undefined}
          />
        </div>

        <div className="space-y-4">
          <MinesControls
            isGameActive={Boolean(isGameActive)}
            isBusy={busy}
            isAuthed={isAuthed}
            balanceMinor={balance}
            amount={amount}
            onAmountChange={setAmount}
            mineCount={isGameActive && game ? game.mineCount : mineCount}
            onMineCountChange={setMineCount}
            minBetMinor={minBet}
            maxBetMinor={maxBet}
            minMines={limits.minMines}
            maxMines={limits.maxMines}
            totalTiles={limits.totalTiles}
            multiplierBps={game?.multiplierBps ?? 10_000}
            currentPayoutMinor={game?.currentPayoutMinor ?? '0'}
            revealedCount={game?.revealedTiles.length ?? 0}
            onStart={handleStart}
            onCashout={handleCashout}
            mode={mode}
            onModeChange={(m) => {
              setMode(m);
              // При переходе из ручного в авто очищаем завершённую игру с поля,
              // чтобы стало видно выбранные клетки и нечего не мешало.
              if (m === 'auto' && game && game.status !== 'ACTIVE') {
                setGame(null);
                setPendingTile(null);
              }
            }}
            autoConfig={autoConfig}
            onAutoConfigChange={setAutoConfig}
            autoRunning={autoRunning}
            autoRoundsDone={autoRoundsDone}
            onAutoStart={() => { void handleAutoStart(); }}
            onAutoStop={handleAutoStop}
            autoSelectedCount={autoSelectedTiles.length}
            onAutoSelectionClear={handleAutoSelectionClear}
          />
          <MinesHistory items={history} />
        </div>
      </div>

      {/* Provably-fair раскрытие после завершения */}
      {game && game.status !== 'ACTIVE' && game.serverSeed ? (
        <div className="rounded-lg border border-border bg-bg-elevated p-3 text-xs">
          <div className="mb-1 text-text-muted">{t('fair.title')}</div>
          <dl className="space-y-1">
            <div className="flex items-start justify-between gap-2">
              <dt className="text-text-muted">{t('fair.serverSeedHash')}</dt>
              <dd className="truncate font-mono text-[11px] text-text-secondary" title={game.serverSeedHash}>
                {game.serverSeedHash.slice(0, 16)}…
              </dd>
            </div>
            <div className="flex items-start justify-between gap-2">
              <dt className="text-text-muted">{t('fair.serverSeed')}</dt>
              <dd className="truncate font-mono text-[11px] text-text-secondary" title={game.serverSeed}>
                {game.serverSeed.slice(0, 16)}…
              </dd>
            </div>
            <div className="flex items-start justify-between gap-2">
              <dt className="text-text-muted">{t('fair.clientSeed')}</dt>
              <dd className="truncate font-mono text-[11px] text-text-secondary" title={game.clientSeed}>
                {game.clientSeed}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-2">
              <dt className="text-text-muted">{t('fair.nonce')}</dt>
              <dd className="font-mono text-[11px] text-text-secondary">{game.nonce}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      <MinesInfoModal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        minBetAzn={Number(limits.minBetMinor) / 100}
        maxBetAzn={Number(limits.maxBetMinor) / 100}
      />
    </div>
  );
}

function handleApiError(e: unknown, t: (k: string) => string): void {
  if (e instanceof ApiException) {
    const code = e.message;
    const map: Record<string, string> = {
      MINES_DISABLED: t('errors.disabled'),
      GAME_ALREADY_ACTIVE: t('errors.alreadyActive'),
      INSUFFICIENT_FUNDS: t('errors.insufficient'),
      NO_ACTIVE_GAME: t('errors.noActive'),
      TILE_ALREADY_REVEALED: t('errors.tileRevealed'),
      NO_REVEALED_TILES: t('errors.noRevealed'),
      INVALID_MINE_COUNT: t('errors.invalidMineCount'),
      INVALID_TILE: t('errors.invalidTile'),
      AMOUNT_OUT_OF_RANGE: t('errors.outOfRange'),
    };
    toast.error(map[code] ?? code ?? t('errors.unknown'));
    return;
  }
  toast.error(t('errors.unknown'));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


