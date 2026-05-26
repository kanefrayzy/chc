'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { cn } from '@chcgreen/ui';
import { useUi } from '@/components/layout/ui-context';
import {
  classicApi,
  type ClassicLimitsDto,
  type ClassicParticipantDto,
  type ClassicRoundDto,
} from '@/lib/api/classic';
import { useClassicSocket } from '@/lib/realtime/useClassicSocket';
import { walletApi } from '@/lib/api/wallet';
import {
  playClick,
  playCountdownTick,
  playLose,
  playTick,
  playWin,
} from '@/lib/sound';

export interface ClassicLayoutProps {
  isAuthed: boolean;
  balanceMinor: string | null;
  limits: ClassicLimitsDto;
  initialRound: ClassicRoundDto | null;
  initialHistory: ClassicRoundDto[];
  currentUserId: string | null;
}

interface ResultInfo {
  roundId: string;
  winnerId: string;
  winnerUsername: string | null;
  winnerAvatarUrl: string | null;
  bankMinor: string;
  payoutMinor: string;
  isMe: boolean;
}

function formatAzn(amountMinor: string | bigint): string {
  const v = typeof amountMinor === 'bigint' ? amountMinor : BigInt(amountMinor || '0');
  const major = v / 100n;
  const fraction = (v < 0n ? -v : v) % 100n;
  return `${major}.${fraction.toString().padStart(2, '0')}`;
}

function formatChance(bps: number): string {
  return (bps / 100).toFixed(2);
}

function formatSecs(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
}

const RIBBON_TILE_PX = 120;
const RIBBON_TILES_COUNT = 220;
const WINNER_TILE_FRACTION = 0.88;

/**
 * Классический jackpot — переработанный дизайн.
 * Центр: большая круговая диаграмма шансов + банк в центре + кольцо-таймер.
 * Слева: панель ставки. Справа: плотный список игроков.
 * Сверху во время ROLLING/COMPLETED — длинная лента-барабан с указателем.
 * Снизу: лента истории и provably-fair.
 */
export function ClassicLayout({
  isAuthed,
  balanceMinor: initialBalance,
  limits,
  initialRound,
  initialHistory,
  currentUserId,
}: ClassicLayoutProps): JSX.Element {
  const t = useTranslations('classic');
  const { refreshBalance, openAuth, openDeposit } = useUi();

  const [round, setRound] = useState<ClassicRoundDto | null>(initialRound);
  const [history, setHistory] = useState<ClassicRoundDto[]>(initialHistory);
  const [balance, setBalance] = useState<string | null>(initialBalance);
  const [result, setResult] = useState<ResultInfo | null>(null);
  const [spinProgress, setSpinProgress] = useState(0);
  const [betInput, setBetInput] = useState<string>(
    (Number(limits.minBetMinor) / 100).toFixed(2),
  );
  const [submitting, setSubmitting] = useState(false);

  const prevRoundIdRef = useRef<string | null>(initialRound?.id ?? null);
  const lastTickRef = useRef(0);

  const reloadBalance = useCallback(async (): Promise<void> => {
    if (!isAuthed) return;
    try {
      const b = await walletApi.balance();
      setBalance(b.balanceMinor);
      refreshBalance();
    } catch {
      /* */
    }
  }, [isAuthed, refreshBalance]);

  useClassicSocket({
    onRound: (r) => setRound(r),
    onCompleted: (e) => {
      const isMe = !!currentUserId && e.winnerId === currentUserId;
      setResult({
        roundId: e.roundId,
        winnerId: e.winnerId,
        winnerUsername: e.winnerUsername,
        winnerAvatarUrl: e.winnerAvatarUrl,
        bankMinor: e.bankMinor,
        payoutMinor: e.payoutMinor,
        isMe,
      });
      if (isMe) playWin();
      else playLose();
      void reloadBalance();
      void classicApi
        .history(15)
        .then((res) => setHistory(res.items))
        .catch(() => undefined);
    },
  });

  useEffect(() => {
    if (!round) return;
    if (prevRoundIdRef.current !== round.id) {
      prevRoundIdRef.current = round.id;
      if (round.status === 'OPEN') {
        const tm = setTimeout(() => setResult(null), 3500);
        return () => clearTimeout(tm);
      }
    }
    return undefined;
  }, [round]);

  // Анимация ленты — драматичный easeOutQuint, длинный путь.
  useEffect(() => {
    if (!round || round.status !== 'ROLLING') {
      setSpinProgress(0);
      return;
    }
    const totalMs = limits.rollingDurationSec * 1000;
    const startedAt = performance.now();
    let raf = 0;
    const step = (): void => {
      const elapsed = performance.now() - startedAt;
      const p = Math.min(1, elapsed / totalMs);
      setSpinProgress(p);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [round?.status, round?.id, limits.rollingDurationSec]);

  // Тик последних 10 секунд.
  useEffect(() => {
    if (!round || round.status !== 'OPEN' || !round.countdownStartedAt) return;
    const endsAt = new Date(round.endsAt).getTime();
    const iv = setInterval(() => {
      const left = endsAt - Date.now();
      if (left <= 10_000 && left > 0) {
        const sec = Math.ceil(left / 1000);
        if (sec !== lastTickRef.current) {
          lastTickRef.current = sec;
          playCountdownTick();
        }
      }
    }, 250);
    return () => clearInterval(iv);
  }, [round?.status, round?.endsAt, round?.countdownStartedAt]);

  // Звук на изменение банка.
  const prevBankRef = useRef<string>('0');
  useEffect(() => {
    if (!round) return;
    if (round.bankMinor !== prevBankRef.current) {
      if (prevBankRef.current !== '0') playTick();
      prevBankRef.current = round.bankMinor;
    }
  }, [round?.bankMinor]);

  const participants = round?.participants ?? [];
  const bankMinor = round?.bankMinor ?? '0';
  const commissionPct = (round?.commissionBps ?? 700) / 100;
  const status = round?.status ?? 'OPEN';
  const isOpen = status === 'OPEN';
  const isRolling = status === 'ROLLING';
  const isCompleted = status === 'COMPLETED';
  const uniqueCount = participants.length;
  const minPlayers = limits.minPlayersToStart;
  const countdownActive = isOpen && uniqueCount >= minPlayers && !!round?.countdownStartedAt;
  const myParticipant = currentUserId
    ? participants.find((p) => p.userId === currentUserId)
    : undefined;
  const myStake = myParticipant?.totalMinor ?? '0';
  const myChanceBps = myParticipant?.chanceBps ?? 0;

  const [, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(iv);
  }, []);
  const countdownMs =
    round && countdownActive ? new Date(round.endsAt).getTime() - Date.now() : 0;
  const countdownFrac = countdownActive
    ? Math.max(0, Math.min(1, countdownMs / (limits.roundDurationSec * 1000)))
    : 0;

  const handleBet = useCallback(async (): Promise<void> => {
    if (!isAuthed) {
      openAuth('login');
      return;
    }
    if (!isOpen) {
      toast.error(t('errors.bettingClosed'));
      return;
    }
    const azn = Number(betInput);
    if (!Number.isFinite(azn) || azn <= 0) {
      toast.error(t('errors.invalidAmount'));
      return;
    }
    const amountMinor = BigInt(Math.round(azn * 100));
    const minBet = BigInt(limits.minBetMinor);
    const maxBet = BigInt(limits.maxBetMinor);
    if (amountMinor < minBet || amountMinor > maxBet) {
      toast.error(
        t('errors.amountRange', {
          min: formatAzn(limits.minBetMinor),
          max: formatAzn(limits.maxBetMinor),
        }),
      );
      return;
    }
    if (balance && BigInt(balance) < amountMinor) {
      toast.error(t('errors.insufficient'));
      openDeposit();
      return;
    }
    setSubmitting(true);
    playClick();
    try {
      await classicApi.placeBet(amountMinor.toString());
      void reloadBalance();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(t('errors.betFailed', { reason: msg }));
    } finally {
      setSubmitting(false);
    }
  }, [isAuthed, isOpen, betInput, balance, limits, openAuth, openDeposit, reloadBalance, t]);

  // Лента-барабан.
  const ribbonTiles = useMemo(() => {
    if (participants.length === 0) return [] as ClassicParticipantDto[];
    const totalBps = participants.reduce((s, p) => s + p.chanceBps, 0) || 10000;
    const tiles: ClassicParticipantDto[] = [];
    const acc = participants.map((p) => ({ p, acc: 0 }));
    for (let i = 0; i < RIBBON_TILES_COUNT; i++) {
      let best = acc[0]!;
      let bestDebt = -Infinity;
      for (const a of acc) {
        const target = a.p.chanceBps / totalBps;
        const current = i === 0 ? 0 : a.acc / i;
        const debt = target - current;
        if (debt > bestDebt) {
          best = a;
          bestDebt = debt;
        }
      }
      best.acc++;
      tiles.push(best.p);
    }
    const seed = participants.map((p) => p.userId).join('');
    const rng = mulberry32(hashString(seed));
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j]!, tiles[i]!];
    }
    return tiles;
  }, [participants]);

  const winnerTileIndex = useMemo(() => {
    if (!round?.winnerId || ribbonTiles.length === 0) {
      return Math.floor(RIBBON_TILES_COUNT * WINNER_TILE_FRACTION);
    }
    const targetIdx = Math.floor(RIBBON_TILES_COUNT * WINNER_TILE_FRACTION);
    // Найти ближайший к targetIdx тайл победителя.
    let best = targetIdx;
    let bestDist = Infinity;
    ribbonTiles.forEach((p, i) => {
      if (p.userId !== round.winnerId) return;
      const d = Math.abs(i - targetIdx);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  }, [ribbonTiles, round?.winnerId]);

  const statusBadge = isRolling
    ? { label: t('rolling'), tone: 'warning' as const }
    : isCompleted
      ? { label: t('lastWinner'), tone: 'success' as const }
      : countdownActive
        ? { label: t('countdown'), tone: 'brand' as const }
        : { label: t('waiting'), tone: 'muted' as const };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-3 sm:p-5">
      {/* Хедер */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-bg">
            <CrownIcon />
          </div>
          <div>
            <h1 className="text-xl font-extrabold uppercase tracking-wider text-text-primary sm:text-2xl">
              {t('pageTitle')}
            </h1>
            <div className="flex items-center gap-2 text-[11px] text-text-muted">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-bold uppercase tracking-wider',
                  statusBadge.tone === 'warning' && 'bg-warning/15 text-warning',
                  statusBadge.tone === 'success' && 'bg-success/15 text-success',
                  statusBadge.tone === 'brand' && 'bg-brand/15 text-brand',
                  statusBadge.tone === 'muted' && 'bg-bg-elevated text-text-secondary',
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    statusBadge.tone === 'warning' && 'animate-pulse bg-warning',
                    statusBadge.tone === 'success' && 'bg-success',
                    statusBadge.tone === 'brand' && 'animate-pulse bg-brand',
                    statusBadge.tone === 'muted' && 'bg-text-muted',
                  )}
                />
                {statusBadge.label}
              </span>
              <span>•</span>
              <span>
                {t('commission')}:{' '}
                <span className="font-mono text-text-secondary">{commissionPct.toFixed(2)}%</span>
              </span>
            </div>
          </div>
        </div>
        <div className="hidden gap-4 text-right sm:flex">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              {t('participants')}
            </div>
            <div className="font-mono text-lg font-extrabold text-text-primary">
              {uniqueCount}
            </div>
          </div>
          {isAuthed && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                {t('bet.balance')}
              </div>
              <div className="font-mono text-lg font-extrabold text-brand">
                {formatAzn(balance ?? '0')}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Лента-барабан */}
      {(isRolling || (isCompleted && result)) && (
        <RollingRibbon
          tiles={ribbonTiles}
          winnerIndex={winnerTileIndex}
          progress={isRolling ? spinProgress : 1}
          label={isRolling ? t('rollingTitle') : t('winnerIs')}
        />
      )}

      {/* Главный блок: ставка | арена | игроки */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[300px_1fr_320px]">
        {/* Панель ставки */}
        <section className="rounded-2xl border border-border bg-bg-card p-4 shadow-card">
          <div>
            <h2 className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-text-secondary">
              {t('bet.title')}
            </h2>

            <div className="mt-4">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                {t('bet.amount')}
              </label>
              <div className="relative mt-1">
                <input
                  type="number"
                  className="h-12 w-full rounded-xl border-2 border-border bg-bg pr-14 pl-3 text-center font-mono text-xl font-extrabold text-text-primary focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-50"
                  value={betInput}
                  min={Number(limits.minBetMinor) / 100}
                  max={Number(limits.maxBetMinor) / 100}
                  step={0.01}
                  onChange={(e) => setBetInput(e.target.value)}
                  disabled={!isOpen || submitting}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted">
                  AZN
                </span>
              </div>
              <div className="mt-1 text-center text-[10px] text-text-muted">
                {t('bet.limits', {
                  min: formatAzn(limits.minBetMinor),
                  max: formatAzn(limits.maxBetMinor),
                })}
              </div>
            </div>

            <div className="mt-2 grid grid-cols-4 gap-1">
              {[
                { label: '+1', add: 1 },
                { label: '+5', add: 5 },
                { label: '+10', add: 10 },
                { label: 'MAX', max: true },
              ].map((b) => (
                <button
                  key={b.label}
                  type="button"
                  onClick={() => {
                    if (b.max) {
                      setBetInput((Number(limits.maxBetMinor) / 100).toFixed(2));
                    } else {
                      const cur = Number(betInput) || 0;
                      setBetInput((cur + (b.add ?? 0)).toFixed(2));
                    }
                  }}
                  disabled={!isOpen || submitting}
                  className="h-8 rounded-lg border border-border bg-bg-elevated text-[11px] font-bold text-text-secondary transition-colors hover:border-brand hover:text-brand disabled:opacity-40"
                >
                  {b.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => void (isAuthed ? handleBet() : openAuth('login'))}
              disabled={isAuthed && (!isOpen || submitting)}
              className={cn(
                'mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-extrabold uppercase tracking-[0.18em] transition-colors',
                !isAuthed
                  ? 'bg-accent text-white hover:brightness-110 active:scale-[0.98]'
                  : isOpen && !submitting
                    ? 'bg-brand text-black hover:brightness-110 active:scale-[0.98]'
                    : 'cursor-not-allowed bg-bg-elevated text-text-muted',
              )}
            >
              {!isAuthed ? (
                t('bet.loginToBet')
              ) : submitting ? (
                <Spinner />
              ) : (
                <>
                  <BoltIcon />
                  {t('bet.placeBet')}
                </>
              )}
            </button>

            {myParticipant && (
              <div className="mt-3 rounded-xl border border-brand/30 bg-brand/5 p-2.5">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-text-muted">
                  <span>{t('bet.yourStake')}</span>
                  <span>{t('bet.yourChance')}</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between font-mono text-sm font-extrabold text-brand">
                  <span>{formatAzn(myStake)}</span>
                  <span>{formatChance(myChanceBps)}%</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Арена: донат + банк */}
        <section className="relative flex items-center justify-center overflow-hidden rounded-2xl border border-border bg-bg-card shadow-card">
          <div className="relative flex flex-col items-center py-6">
            <ChanceDonut
              participants={participants}
              countdownFrac={countdownFrac}
              countdownActive={countdownActive}
              isRolling={isRolling}
              isCompleted={isCompleted}
              bankMinor={bankMinor}
              currentUserId={currentUserId}
              winnerId={round?.winnerId ?? null}
              countdownLabel={
                isRolling
                  ? '...'
                  : isCompleted
                    ? `+${formatAzn(round?.payoutMinor ?? '0')}`
                    : countdownActive
                      ? formatSecs(countdownMs)
                      : null
              }
              waitingText={
                !isRolling && !isCompleted && !countdownActive
                  ? t('waitingPlayers', { current: uniqueCount, need: minPlayers })
                  : null
              }
              dangerCountdown={countdownActive && countdownMs < 5000}
            />
            <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-text-muted">
              {t('bank')}
            </div>
            <div className="font-mono text-4xl font-black tracking-tight text-brand sm:text-5xl">
              {formatAzn(bankMinor)}
              <span className="ml-2 text-xl text-text-secondary">AZN</span>
            </div>
          </div>
        </section>

        {/* Игроки — плотный список */}
        <section className="flex flex-col overflow-hidden rounded-2xl border border-border bg-bg-card shadow-card">
          <header className="flex items-center justify-between border-b border-border px-3 py-2">
            <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-text-secondary">
              {t('participants')}
            </h2>
            <span className="rounded-full bg-bg-elevated px-2 py-0.5 font-mono text-[11px] font-bold text-text-primary">
              {uniqueCount}
            </span>
          </header>
          {participants.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-3 py-10 text-center text-xs text-text-muted">
              {t('noBets')}
            </div>
          ) : (
            <ul className="flex max-h-[500px] flex-col divide-y divide-border/60 overflow-y-auto">
              {[...participants]
                .sort((a, b) => b.chanceBps - a.chanceBps)
                .map((p) => (
                  <PlayerRow
                    key={p.userId}
                    p={p}
                    isMe={p.userId === currentUserId}
                    isWinner={(isRolling || isCompleted) && p.userId === round?.winnerId}
                    youLabel={t('you')}
                  />
                ))}
            </ul>
          )}
        </section>
      </div>

      {/* История + provably-fair */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[2fr_3fr]">
        <section className="overflow-hidden rounded-2xl border border-border bg-bg-card shadow-card">
          <header className="border-b border-border px-3 py-2">
            <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-text-secondary">
              {t('history.title')}
            </h2>
          </header>
          {history.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-text-muted">{t('history.empty')}</div>
          ) : (
            <div className="flex gap-2 overflow-x-auto p-2">
              {history.map((h) => {
                const winnerColor =
                  h.participants.find((p) => p.userId === h.winnerId)?.color ?? '#888';
                return (
                  <div
                    key={h.id}
                    className="flex w-[112px] shrink-0 flex-col items-center gap-1 rounded-xl border bg-bg-elevated/40 p-2"
                    style={{ borderColor: `${winnerColor}55` }}
                  >
                    <div
                      className="h-10 w-10 overflow-hidden rounded-full"
                      style={{ outline: '2px solid', outlineColor: winnerColor }}
                    >
                      {h.winnerAvatarUrl ? (
                        <Image
                          src={h.winnerAvatarUrl}
                          alt=""
                          width={40}
                          height={40}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-bg text-xs font-bold text-text-secondary">
                          {(h.winnerUsername ?? '?').slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="w-full truncate text-center text-[10px] text-text-secondary">
                      {h.winnerUsername ?? '—'}
                    </div>
                    <div className="font-mono text-xs font-extrabold text-success">
                      +{formatAzn(h.payoutMinor)}
                    </div>
                    <div className="font-mono text-[9px] text-text-muted">
                      {new Date(h.completedAt ?? h.startedAt).toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {round && (
          <section className="overflow-hidden rounded-2xl border border-border bg-bg-card shadow-card">
            <header className="border-b border-border px-3 py-2">
              <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-text-secondary">
                {t('fair.title')}
              </h2>
            </header>
            <dl className="grid grid-cols-1 gap-2 p-3 text-[11px] sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-text-muted">{t('fair.serverSeedHash')}</dt>
                <dd className="mt-0.5 break-all font-mono text-text-secondary">
                  {round.serverSeedHash}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">{t('fair.publicSeed')}</dt>
                <dd className="mt-0.5 break-all font-mono text-text-secondary">
                  {round.publicSeed ?? '—'}
                </dd>
              </div>
              {round.winningTicket !== null && (
                <div>
                  <dt className="text-text-muted">{t('fair.winningTicket')}</dt>
                  <dd className="mt-0.5 font-mono text-text-secondary">#{round.winningTicket}</dd>
                </div>
              )}
              {round.serverSeed && (
                <div className="sm:col-span-2">
                  <dt className="text-text-muted">{t('fair.serverSeed')}</dt>
                  <dd className="mt-0.5 break-all font-mono text-text-secondary">
                    {round.serverSeed}
                  </dd>
                </div>
              )}
            </dl>
          </section>
        )}
      </div>

      {result && <WinnerOverlay result={result} t={t} onClose={() => setResult(null)} />}
    </div>
  );
}

// ── Донат шансов ────────────────────────────────────────────────────────
function ChanceDonut({
  participants,
  countdownFrac,
  countdownActive,
  isRolling,
  isCompleted,
  bankMinor: _bankMinor,
  currentUserId,
  winnerId,
  countdownLabel,
  waitingText,
  dangerCountdown,
}: {
  participants: ClassicParticipantDto[];
  countdownFrac: number;
  countdownActive: boolean;
  isRolling: boolean;
  isCompleted: boolean;
  bankMinor: string;
  currentUserId: string | null;
  winnerId: string | null;
  countdownLabel: string | null;
  waitingText: string | null;
  dangerCountdown: boolean;
}): JSX.Element {
  const R_OUTER = 96; // радиус кольца-таймера
  const R_INNER = 78; // радиус кольца долей
  const C_OUTER = 2 * Math.PI * R_OUTER;
  const C_INNER = 2 * Math.PI * R_INNER;

  const totalBps = participants.reduce((s, p) => s + p.chanceBps, 0) || 0;
  void _bankMinor;

  let acc = 0;
  return (
    <div className="relative">
      <svg
        viewBox="-110 -110 220 220"
        className="h-[220px] w-[220px] sm:h-[260px] sm:w-[260px]"
      >
        {/* Внешнее кольцо: фон таймера */}
        <circle
          r={R_OUTER}
          cx={0}
          cy={0}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={5}
        />
        {/* Внешнее кольцо: прогресс таймера */}
        {countdownActive && (
          <circle
            r={R_OUTER}
            cx={0}
            cy={0}
            fill="none"
            stroke={dangerCountdown ? 'var(--color-danger, #ff4d4f)' : 'var(--color-brand, #00ff88)'}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={`${C_OUTER * countdownFrac} ${C_OUTER}`}
            transform="rotate(-90)"
            style={{ transition: 'stroke-dasharray 0.2s linear' }}
          />
        )}

        {/* Внутреннее кольцо: фон */}
        <circle
          r={R_INNER}
          cx={0}
          cy={0}
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth={18}
        />

        {/* Сегменты шансов */}
        {participants.length === 0 ? (
          <circle
            r={R_INNER}
            cx={0}
            cy={0}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={18}
            strokeDasharray="4 6"
          />
        ) : (
          participants.map((p) => {
            const frac = totalBps > 0 ? p.chanceBps / totalBps : 0;
            const dashLen = Math.max(frac * C_INNER - 2, 0);
            const offset = -acc * C_INNER;
            acc += frac;
            const isHi =
              (currentUserId && p.userId === currentUserId) ||
              (winnerId && p.userId === winnerId);
            return (
              <circle
                key={p.userId}
                r={R_INNER}
                cx={0}
                cy={0}
                fill="none"
                stroke={p.color}
                strokeWidth={isHi ? 22 : 18}
                strokeDasharray={`${dashLen} ${C_INNER}`}
                strokeDashoffset={offset}
                transform="rotate(-90)"
                style={{
                  transition: 'stroke-dasharray 0.4s ease, stroke-width 0.2s ease',
                }}
              />
            );
          })
        )}

        {/* Центр — тёмный диск для контраста */}
        <circle r={R_INNER - 12} cx={0} cy={0} fill="rgba(0,0,0,0.35)" />
      </svg>

      {/* Центральная подпись (таймер / результат / ожидание) */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        {countdownLabel ? (
          <div
            className={cn(
              'font-mono text-3xl font-black tracking-tight sm:text-4xl',
              isRolling && 'text-warning',
              isCompleted && 'text-success',
              !isRolling && !isCompleted && dangerCountdown && 'text-danger',
              !isRolling && !isCompleted && !dangerCountdown && 'text-text-primary',
            )}
          >
            {countdownLabel}
          </div>
        ) : waitingText ? (
          <div className="max-w-[140px] text-[11px] font-semibold uppercase leading-tight tracking-wider text-text-secondary">
            {waitingText}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Лента-барабан ────────────────────────────────────────────────────────
function RollingRibbon({
  tiles,
  winnerIndex,
  progress,
  label,
}: {
  tiles: ClassicParticipantDto[];
  winnerIndex: number;
  progress: number;
  label: string;
}): JSX.Element {
  // easeOutQuint — длинный драматичный старт + плавная остановка
  const eased = 1 - Math.pow(1 - progress, 5);
  const offsetTiles = eased * winnerIndex;
  const translatePx = -offsetTiles * RIBBON_TILE_PX;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-warning/40 bg-bg-card p-3">
      <div className="mb-2 flex items-center justify-center gap-2 text-center text-[11px] font-black uppercase tracking-[0.3em] text-warning">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warning" />
        {label}
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warning" />
      </div>
      <div className="relative h-36 overflow-hidden rounded-xl bg-bg ring-1 ring-border">
        {/* Указатель */}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 -translate-x-1/2">
          <div className="h-full w-[3px] bg-warning" />
        </div>
        <div className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2">
          <div className="h-0 w-0 border-x-[10px] border-t-[12px] border-x-transparent border-t-warning" />
        </div>
        <div className="pointer-events-none absolute bottom-0 left-1/2 z-20 -translate-x-1/2">
          <div className="h-0 w-0 border-x-[10px] border-b-[12px] border-x-transparent border-b-warning" />
        </div>

        <div
          className="flex h-full will-change-transform"
          style={{
            transform: `translate3d(calc(50% + ${translatePx}px - ${RIBBON_TILE_PX / 2}px), 0, 0)`,
          }}
        >
          {tiles.map((p, i) => (
            <RibbonTile key={i} p={p} />
          ))}
        </div>

        {/* Затемнения по краям */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-bg to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-bg to-transparent" />
      </div>
    </div>
  );
}

function RibbonTile({ p }: { p: ClassicParticipantDto }): JSX.Element {
  return (
    <div
      className="relative h-full shrink-0 overflow-hidden"
      style={{ width: RIBBON_TILE_PX, backgroundColor: p.color }}
    >
      {p.avatarUrl ? (
        <Image
          src={p.avatarUrl}
          alt={p.username}
          width={RIBBON_TILE_PX}
          height={144}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-3xl font-black text-white">
          {p.username.slice(0, 1).toUpperCase()}
        </div>
      )}
      {/* нижняя полоска с процентом */}
      <div
        className="absolute inset-x-0 bottom-0 px-1 py-0.5 text-center font-mono text-[11px] font-black text-white"
        style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      >
        {formatChance(p.chanceBps)}%
      </div>
      {/* верхняя полоска цветом для яркости в ленте */}
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: p.color }}
      />
    </div>
  );
}

// ── Строка игрока ──────────────────────────────────────────────────────
function PlayerRow({
  p,
  isMe,
  isWinner,
  youLabel,
}: {
  p: ClassicParticipantDto;
  isMe: boolean;
  isWinner: boolean;
  youLabel: string;
}): JSX.Element {
  const chancePct = p.chanceBps / 100;
  return (
    <li
      className={cn(
        'relative flex items-center gap-2 px-2.5 py-2 transition-colors',
        isMe && 'bg-brand/5',
        isWinner && 'bg-success/10',
      )}
    >
      {/* цветной вертикальный бар слева */}
      <span
        className="absolute inset-y-1 left-0 w-1 rounded-r"
        style={{ backgroundColor: p.color }}
      />
      <div
        className="h-9 w-9 shrink-0 overflow-hidden rounded-full"
        style={{
          outline: '2px solid',
          outlineColor: p.color,
          boxShadow: isWinner ? `0 0 12px ${p.color}` : undefined,
        }}
      >
        {p.avatarUrl ? (
          <Image
            src={p.avatarUrl}
            alt={p.username}
            width={36}
            height={36}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-sm font-bold text-white"
            style={{ backgroundColor: p.color }}
          >
            {p.username.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-semibold text-text-primary">{p.username}</span>
          {isMe && (
            <span className="rounded bg-brand/20 px-1 text-[8px] font-extrabold uppercase tracking-wider text-brand">
              {youLabel}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-bg-elevated">
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{ width: `${chancePct}%`, backgroundColor: p.color }}
            />
          </div>
          <span className="font-mono text-[10px] font-bold text-text-secondary">
            {chancePct.toFixed(2)}%
          </span>
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-xs font-extrabold text-text-primary">
          {formatAzn(p.totalMinor)}
        </div>
        <div className="text-[9px] uppercase text-text-muted">AZN</div>
      </div>
    </li>
  );
}

// ── Оверлей победителя ─────────────────────────────────────────────────
function WinnerOverlay({
  result,
  t,
  onClose,
}: {
  result: ResultInfo;
  t: ReturnType<typeof useTranslations>;
  onClose: () => void;
}): JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className={cn(
          'relative flex flex-col items-center gap-3 overflow-hidden rounded-3xl px-12 py-10 ring-2',
          result.isMe ? 'bg-bg-card ring-success' : 'bg-bg-card ring-border',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <div className="relative h-28 w-28 overflow-hidden rounded-full ring-4 ring-white/20">
            {result.winnerAvatarUrl ? (
              <Image
                src={result.winnerAvatarUrl}
                alt=""
                width={112}
                height={112}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-bg-elevated text-3xl font-bold text-text-secondary">
                {(result.winnerUsername ?? '?').slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
        </div>
        <div className="text-[11px] font-extrabold uppercase tracking-[0.3em] text-text-secondary">
          {result.isMe ? t('youWon') : t('winnerIs')}
        </div>
        <div className="text-2xl font-black text-text-primary">
          {result.winnerUsername ?? '—'}
        </div>
        <div className="font-mono text-4xl font-black text-success">
          +{formatAzn(result.payoutMinor)}
          <span className="ml-2 text-xl text-text-secondary">AZN</span>
        </div>
      </div>
    </div>
  );
}

// ── Иконки ──────────────────────────────────────────────────────────────
function BoltIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
    </svg>
  );
}

function CrownIcon(): JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M2 7l4 6 6-8 6 8 4-6v12H2V7zm2 14h16v-2H4v2z" />
    </svg>
  );
}

function Spinner(): JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="origin-center [animation:spin_0.8s_linear_infinite]"
        style={{ transformOrigin: '12px 12px' }}
      />
    </svg>
  );
}

// ── Утилиты ─────────────────────────────────────────────────────────────
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
