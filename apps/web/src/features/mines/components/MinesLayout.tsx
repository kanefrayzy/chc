'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Spinner } from '@chcgreen/ui';
import { MinesGrid } from './MinesGrid';
import { MinesControls } from './MinesControls';
import { MinesHistory } from './MinesHistory';
import { MinesInfoModal } from './MinesInfoModal';
import { minesApi, type MinesGameDto, type MinesLimitsDto } from '@/lib/api/mines';
import { walletApi } from '@/lib/api/wallet';
import { useMinesSocket } from '@/lib/realtime/useMinesSocket';
import { useUi } from '@/components/layout/ui-context';
import { ApiException } from '@/lib/api/client';
import { parseAmountToMinor } from '@/features/deposits/components/AmountInput';
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
        setGame(stateRes.game);
        setHistory(histRes.items);
        if (stateRes.game?.mineCount) setMineCount(stateRes.game.mineCount);
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
          <p className="text-sm text-text-muted">{t('description')}</p>
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
          {/* Игровая статусная полоса */}
          {game ? (
            <div className="flex w-full max-w-[640px] items-center justify-between rounded-lg border border-border bg-bg-elevated px-3 py-2 text-xs">
              <span className="text-text-muted">
                {t('status.label')}:{' '}
                <span className="font-semibold text-text-primary">{t(`status.${game.status}`)}</span>
              </span>
              <span className="font-mono text-text-muted">
                {t('status.opened', { count: game.revealedTiles.length, total: limits.totalTiles - game.mineCount })}
              </span>
            </div>
          ) : null}

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
          />

          {/* Provably-fair раскрытие после завершения */}
          {game && game.status !== 'ACTIVE' && game.serverSeed ? (
            <div className="w-full max-w-[640px] rounded-lg border border-border bg-bg-elevated p-3 text-xs">
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
            multiplierBps={game?.multiplierBps ?? 10_000}
            currentPayoutMinor={game?.currentPayoutMinor ?? '0'}
            revealedCount={game?.revealedTiles.length ?? 0}
            onStart={handleStart}
            onCashout={handleCashout}
          />
          <MinesHistory items={history} />
        </div>
      </div>

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
