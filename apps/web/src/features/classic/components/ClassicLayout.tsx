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

const RIBBON_TILE_PX = 96;

/**
 * Классический jackpot.
 *  - Сверху во время ROLLING: горизонтальная лента-барабан с указателем в центре.
 *  - Затем верхний ряд: панель ставки | банк | таймер.
 *  - Карточки игроков с цветными бордерами/фоном и процентами.
 *  - Снизу: история раундов и provably-fair.
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

  // Скрываем оверлей при появлении нового OPEN-раунда.
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

  // Анимация ленты.
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

  // Звук тика.
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
  const bankBig = BigInt(bankMinor);
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
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, []);
  const countdownMs =
    round && countdownActive ? new Date(round.endsAt).getTime() - Date.now() : 0;

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
  }, [
    isAuthed, isOpen, betInput, balance, limits, openAuth, openDeposit, reloadBalance, t,
  ]);

  // Лента-барабан: распределяем тайлы по долям банка.
  const ribbonTiles = useMemo(() => {
    if (participants.length === 0) return [] as ClassicParticipantDto[];
    const totalTiles = 80;
    const totalBps = participants.reduce((s, p) => s + p.chanceBps, 0) || 10000;
    const tiles: ClassicParticipantDto[] = [];
    const acc = participants.map((p) => ({ p, acc: 0 }));
    for (let i = 0; i < totalTiles; i++) {
      let best = acc[0]!;
      let bestDebt = -Infinity;
      for (const a of acc) {
        const target = a.p.chanceBps / totalBps;
        const current = (i === 0 ? 0 : a.acc / i);
        const debt = target - current;
        if (debt > bestDebt) {
          best = a;
          bestDebt = debt;
        }
      }
      best.acc++;
      tiles.push(best.p);
    }
    // Псевдослучайная перетасовка для визуального разнообразия (детерминированная по сидам тайлов).
    const seed = participants.map((p) => p.userId).join('');
    const rng = mulberry32(hashString(seed));
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j]!, tiles[i]!];
    }
    return tiles;
  }, [participants]);

  // Индекс тайла-победителя — ближе к концу.
  const winnerTileIndex = useMemo(() => {
    if (!round?.winnerId || ribbonTiles.length === 0) return 40;
    const candidates: number[] = [];
    ribbonTiles.forEach((p, i) => {
      if (p.userId === round.winnerId) candidates.push(i);
    });
    if (candidates.length === 0) return 40;
    return candidates[Math.floor(candidates.length * 0.8)] ?? candidates[candidates.length - 1]!;
  }, [ribbonTiles, round?.winnerId]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">{t('pageTitle')}</h1>
          <p className="mt-1 text-sm text-text-secondary">{t('subtitle')}</p>
        </div>
        <div className="text-xs text-text-muted">
          {t('commission')}:{' '}
          <span className="font-mono text-text-secondary">{commissionPct.toFixed(2)}%</span>
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

      {/* Ставка | банк | таймер */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <section className="rounded-2xl border-2 border-brand/40 bg-bg-card p-4 shadow-card">
          <h2 className="text-center text-xs font-bold uppercase tracking-wider text-text-secondary">
            {t('bet.title')}
          </h2>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBetInput((Number(limits.maxBetMinor) / 100).toFixed(2))}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
              title={t('bet.maxBet')}
              disabled={!isOpen || submitting}
            >
              <BoltIcon />
            </button>
            <input
              type="number"
              className="h-11 w-full rounded-lg border border-border bg-bg-elevated px-3 text-center font-mono text-base font-semibold text-text-primary focus:border-brand focus:outline-none disabled:opacity-50"
              value={betInput}
              min={Number(limits.minBetMinor) / 100}
              max={Number(limits.maxBetMinor) / 100}
              step={0.01}
              onChange={(e) => setBetInput(e.target.value)}
              disabled={!isOpen || submitting}
            />
            <button
              type="button"
              onClick={() => void handleBet()}
              disabled={!isOpen || submitting}
              className={cn(
                'h-11 shrink-0 rounded-lg px-5 text-sm font-extrabold uppercase tracking-wider transition-all',
                isOpen && !submitting
                  ? 'bg-brand text-bg shadow-[0_0_16px_rgba(0,255,136,0.25)] hover:brightness-110 active:scale-[0.97]'
                  : 'cursor-not-allowed bg-bg-elevated text-text-muted',
              )}
            >
              {submitting ? '...' : t('bet.placeBetShort')}
            </button>
          </div>

          <div className="mt-2 text-center text-[11px] text-text-muted">
            {t('bet.limits', {
              min: formatAzn(limits.minBetMinor),
              max: formatAzn(limits.maxBetMinor),
            })}
          </div>

          {!isAuthed ? (
            <button
              type="button"
              onClick={() => openAuth('login')}
              className="mt-3 w-full rounded-lg bg-accent px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90"
            >
              {t('bet.loginToBet')}
            </button>
          ) : myParticipant ? (
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-brand/30 bg-brand/5 p-2 text-[11px]">
              <div>
                <div className="text-text-muted">{t('bet.yourStake')}</div>
                <div className="font-mono font-bold text-brand">{formatAzn(myStake)} AZN</div>
              </div>
              <div className="text-right">
                <div className="text-text-muted">{t('bet.yourChance')}</div>
                <div className="font-mono font-bold text-brand">{formatChance(myChanceBps)}%</div>
              </div>
            </div>
          ) : (
            <div className="mt-3 text-center text-[11px] text-text-muted">
              {t('bet.balance')}:{' '}
              <span className="font-mono text-text-secondary">{formatAzn(balance ?? '0')} AZN</span>
            </div>
          )}
        </section>

        <section className="flex flex-col items-center justify-center rounded-2xl border border-border bg-bg-card p-4 shadow-card">
          <div className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            {t('bank')}
          </div>
          <div className="mt-1 font-mono text-3xl font-extrabold tracking-tight text-brand sm:text-4xl">
            {formatAzn(bankMinor)}
          </div>
          <div className="text-xs font-semibold text-text-muted">AZN</div>
        </section>

        <section className="relative overflow-hidden rounded-2xl border border-border bg-bg-card p-4 shadow-card">
          <div className="text-center text-xs font-semibold uppercase tracking-wider text-text-muted">
            {isRolling
              ? t('rolling')
              : isCompleted
                ? t('lastWinner')
                : countdownActive
                  ? t('countdown')
                  : t('waiting')}
          </div>
          <div className="mt-1 text-center font-mono text-3xl font-extrabold sm:text-4xl">
            {isRolling ? (
              <span className="text-warning">...</span>
            ) : isCompleted ? (
              <span className="text-success">+{formatAzn(round?.payoutMinor ?? '0')}</span>
            ) : countdownActive ? (
              <span className={countdownMs < 5000 ? 'text-danger' : 'text-text-primary'}>
                {formatSecs(countdownMs)}
              </span>
            ) : (
              <span className="text-sm font-medium text-text-secondary">
                {t('waitingPlayers', { current: uniqueCount, need: minPlayers })}
              </span>
            )}
          </div>
          {countdownActive && (
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-bg-elevated">
              <div
                className={cn(
                  'h-full transition-[width] duration-200',
                  countdownMs < 5000 ? 'bg-danger' : 'bg-brand',
                )}
                style={{
                  width: `${Math.max(0, Math.min(100, (countdownMs / (limits.roundDurationSec * 1000)) * 100))}%`,
                }}
              />
            </div>
          )}
        </section>
      </div>

      {/* Карточки игроков */}
      <section>
        {participants.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-bg-card/50 p-10 text-center text-sm text-text-muted">
            {t('noBets')}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {participants.map((p) => (
              <PlayerCard
                key={p.userId}
                p={p}
                isMe={p.userId === currentUserId}
                isWinner={(isRolling || isCompleted) && p.userId === round?.winnerId}
                youLabel={t('you')}
              />
            ))}
          </div>
        )}
      </section>

      {/* История + provably-fair */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_3fr]">
        <section className="rounded-2xl border border-border bg-bg-card shadow-card">
          <header className="border-b border-border px-4 py-2.5">
            <h2 className="text-sm font-semibold text-text-primary">{t('history.title')}</h2>
          </header>
          {history.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-text-muted">{t('history.empty')}</div>
          ) : (
            <ul className="max-h-[300px] divide-y divide-border overflow-y-auto">
              {history.map((h) => {
                const winnerColor =
                  h.participants.find((p) => p.userId === h.winnerId)?.color ?? '#888';
                return (
                  <li key={h.id} className="flex items-center gap-3 px-4 py-2 text-xs">
                    <div
                      className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-bg-elevated"
                      style={{ outline: '2px solid', outlineColor: winnerColor }}
                    >
                      {h.winnerAvatarUrl ? (
                        <Image
                          src={h.winnerAvatarUrl}
                          alt=""
                          width={28}
                          height={28}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-text-secondary">
                          {(h.winnerUsername ?? '?').slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-text-secondary">{h.winnerUsername ?? '—'}</div>
                      <div className="text-text-muted">
                        {new Date(h.completedAt ?? h.startedAt).toLocaleTimeString('ru-RU', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-semibold text-success">
                        +{formatAzn(h.payoutMinor)}
                      </div>
                      <div className="font-mono text-text-muted">
                        {t('history.bank')}: {formatAzn(h.bankMinor)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {round && (
          <section className="rounded-2xl border border-border bg-bg-card p-4 shadow-card">
            <h2 className="mb-2 text-sm font-semibold text-text-primary">{t('fair.title')}</h2>
            <dl className="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
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
                  <dd className="mt-0.5 font-mono text-text-secondary">
                    #{round.winningTicket} / {bankBig.toString()}
                  </dd>
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
  // easeOut cubic
  const eased = 1 - Math.pow(1 - progress, 3);
  const offsetTiles = eased * winnerIndex;
  const translatePx = -offsetTiles * RIBBON_TILE_PX;

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-warning/60 bg-bg-card p-3 shadow-[0_0_24px_rgba(255,191,0,0.18)]">
      <div className="mb-2 text-center text-xs font-extrabold uppercase tracking-[0.2em] text-warning">
        {label}
      </div>
      <div className="relative h-24 overflow-hidden rounded-lg bg-bg-elevated ring-1 ring-border">
        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 -translate-x-1/2">
          <div className="h-full w-[3px] bg-warning shadow-[0_0_8px_rgba(255,191,0,0.9)]" />
        </div>
        <div className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2">
          <div className="h-0 w-0 border-x-[8px] border-t-[10px] border-x-transparent border-t-warning" />
        </div>
        <div className="pointer-events-none absolute bottom-0 left-1/2 z-20 -translate-x-1/2">
          <div className="h-0 w-0 border-x-[8px] border-b-[10px] border-x-transparent border-b-warning" />
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

        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-bg-elevated to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-bg-elevated to-transparent" />
      </div>
    </div>
  );
}

function RibbonTile({ p }: { p: ClassicParticipantDto }): JSX.Element {
  return (
    <div
      className="flex h-full shrink-0 items-center justify-center"
      style={{ width: RIBBON_TILE_PX }}
    >
      <div
        className="h-[80%] w-[80%] overflow-hidden rounded-md"
        style={{ boxShadow: `0 0 0 2px ${p.color}` }}
      >
        {p.avatarUrl ? (
          <Image
            src={p.avatarUrl}
            alt={p.username}
            width={80}
            height={80}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-xl font-bold text-white"
            style={{ backgroundColor: p.color }}
          >
            {p.username.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerCard({
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
  return (
    <div
      className={cn(
        'relative flex flex-col items-center overflow-hidden rounded-xl border-2 p-3 transition-all',
        isWinner && 'ring-2 ring-success ring-offset-2 ring-offset-bg',
      )}
      style={{
        backgroundColor: `${p.color}22`,
        borderColor: p.color,
      }}
    >
      {isMe && (
        <div className="absolute right-1.5 top-1.5 rounded bg-bg/80 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-text-primary">
          {youLabel}
        </div>
      )}
      <div
        className="h-16 w-16 overflow-hidden rounded-full"
        style={{ outline: '3px solid', outlineColor: p.color }}
      >
        {p.avatarUrl ? (
          <Image
            src={p.avatarUrl}
            alt={p.username}
            width={64}
            height={64}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-lg font-bold text-white"
            style={{ backgroundColor: p.color }}
          >
            {p.username.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <div className="mt-2 font-mono text-sm font-extrabold text-text-primary">
        {formatAzn(p.totalMinor)} AZN
      </div>
      <div
        className="mt-1 rounded px-2 py-0.5 font-mono text-[11px] font-bold text-bg"
        style={{ backgroundColor: p.color }}
      >
        {formatChance(p.chanceBps)}%
      </div>
      <div className="mt-1 w-full truncate text-center text-xs text-text-secondary">
        {p.username}
      </div>
    </div>
  );
}

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={cn(
          'flex flex-col items-center gap-3 rounded-2xl px-10 py-8 ring-2',
          result.isMe ? 'bg-success/15 ring-success' : 'bg-bg-card ring-border',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-24 w-24 overflow-hidden rounded-full ring-4 ring-white/20">
          {result.winnerAvatarUrl ? (
            <Image
              src={result.winnerAvatarUrl}
              alt=""
              width={96}
              height={96}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-bg-elevated text-3xl font-bold text-text-secondary">
              {(result.winnerUsername ?? '?').slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <div className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
          {result.isMe ? t('youWon') : t('winnerIs')}
        </div>
        <div className="text-2xl font-extrabold text-text-primary">
          {result.winnerUsername ?? '—'}
        </div>
        <div className="font-mono text-3xl font-extrabold text-success">
          +{formatAzn(result.payoutMinor)} AZN
        </div>
      </div>
    </div>
  );
}

function BoltIcon(): JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
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
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
