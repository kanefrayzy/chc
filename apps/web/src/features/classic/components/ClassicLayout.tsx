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

/**
 * Главный layout «Классического» (jackpot).
 *  - Слева: банк + полоса участников + анимация розыгрыша при ROLLING.
 *  - Справа: панель ставки + список участников + история раундов.
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
  /** Прогресс анимации барабана 0..1 (только в ROLLING). */
  const [spinProgress, setSpinProgress] = useState(0);
  const [betInput, setBetInput] = useState<string>(
    (Number(limits.minBetMinor) / 100).toFixed(2),
  );
  const [submitting, setSubmitting] = useState(false);

  const prevRoundIdRef = useRef<string | null>(initialRound?.id ?? null);
  const prevStatusRef = useRef<string | null>(initialRound?.status ?? null);
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

  // Socket: обновление раунда + результаты.
  useClassicSocket({
    onRound: (r) => {
      setRound((prev) => {
        // Новый раунд (OPEN) → сбросить результат после короткой задержки.
        if (prev && prev.id !== r.id) {
          // ничего, эффекты ниже сами сбросят
        }
        return r;
      });
    },
    onCompleted: (e) => {
      // Запомним последний результат для оверлея.
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
      // Обновим историю
      void classicApi
        .history(15)
        .then((res) => setHistory(res.items))
        .catch(() => undefined);
    },
  });

  // Сбрасываем результат при появлении нового OPEN-раунда.
  useEffect(() => {
    if (!round) return;
    if (prevRoundIdRef.current !== round.id) {
      prevRoundIdRef.current = round.id;
      if (round.status === 'OPEN') {
        // даём оверлею досвернуться ~3.5s и убираем
        const tm = setTimeout(() => setResult(null), 3500);
        return () => clearTimeout(tm);
      }
    }
    return undefined;
  }, [round]);

  // Анимация ROLLING.
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
      const t = Math.min(1, elapsed / totalMs);
      setSpinProgress(t);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [round?.status, round?.id, limits.rollingDurationSec]);

  // Звук тика во время countdown (последние 10 секунд).
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

  // Звук «новой ставки» — реагируем на рост числа участников/банка.
  const prevBankRef = useRef<string>('0');
  useEffect(() => {
    if (!round) return;
    if (round.bankMinor !== prevBankRef.current) {
      if (prevBankRef.current !== '0') playTick();
      prevBankRef.current = round.bankMinor;
    }
  }, [round?.bankMinor]);

  // Запоминаем переход статусов
  useEffect(() => {
    if (!round) return;
    prevStatusRef.current = round.status;
  }, [round?.status]);

  // ── Производные значения ──────────────────────────────────────────────
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
  const waitingForPlayers = isOpen && uniqueCount < minPlayers;
  const countdownActive = isOpen && uniqueCount >= minPlayers && round?.countdownStartedAt;
  const myParticipant =
    currentUserId ? participants.find((p) => p.userId === currentUserId) : undefined;
  const myStake = myParticipant?.totalMinor ?? '0';
  const myChanceBps = myParticipant?.chanceBps ?? 0;
  const winnerPart =
    isRolling || isCompleted
      ? participants.find((p) => p.userId === round?.winnerId)
      : null;

  // Countdown ms
  const [, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, []);
  const countdownMs = round && countdownActive ? new Date(round.endsAt).getTime() - Date.now() : 0;

  // ── Действия ──────────────────────────────────────────────────────────
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

  const adjustBet = (fn: (n: number) => number): void => {
    const min = Number(limits.minBetMinor) / 100;
    const max = Number(limits.maxBetMinor) / 100;
    const cur = Number(betInput) || min;
    const next = Math.max(min, Math.min(max, fn(cur)));
    setBetInput(next.toFixed(2));
  };

  // Полоса участников: суммарная длина в qəpik (= банк).
  const wheelStripData = useMemo(() => {
    if (!round) return [];
    const total = Number(round.bankMinor);
    if (total <= 0) return [];
    return round.participants.map((p) => {
      const len = (Number(p.totalMinor) / total) * 100;
      return { ...p, lenPct: len };
    });
  }, [round]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">{t('pageTitle')}</h1>
          <p className="mt-1 text-sm text-text-secondary">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span>{t('commission')}: <span className="font-mono text-text-secondary">{commissionPct.toFixed(2)}%</span></span>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        {/* ─── ЛЕВАЯ КОЛОНКА ─── */}
        <div className="flex flex-col gap-5">
          {/* Банк + статус */}
          <section className="relative overflow-hidden rounded-2xl border border-border bg-bg-card p-6 shadow-card">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(0,255,136,0.08),_transparent_60%)]" />
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {t('bank')}
                </div>
                <div className="mt-1 text-4xl font-extrabold tracking-tight text-text-primary sm:text-5xl">
                  {formatAzn(bankMinor)} <span className="text-lg font-semibold text-text-muted">AZN</span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {isCompleted ? t('lastWinner') : isRolling ? t('rolling') : countdownActive ? t('countdown') : t('waiting')}
                </div>
                <div className="mt-1 text-3xl font-bold text-text-primary sm:text-4xl">
                  {isRolling ? (
                    <span className="font-mono">···</span>
                  ) : isCompleted ? (
                    <span className="font-mono">{formatAzn(round?.payoutMinor ?? '0')} AZN</span>
                  ) : countdownActive ? (
                    <span className="font-mono">{formatSecs(countdownMs)}</span>
                  ) : (
                    <span className="text-base font-medium text-text-secondary">
                      {t('waitingPlayers', { current: uniqueCount, need: minPlayers })}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Прогресс-бар countdown */}
            {countdownActive && (
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-bg-elevated">
                <div
                  className="h-full bg-brand transition-[width] duration-200"
                  style={{
                    width: `${Math.max(0, Math.min(100, (countdownMs / (limits.roundDurationSec * 1000)) * 100))}%`,
                  }}
                />
              </div>
            )}

            {/* Полоса участников */}
            <div className="mt-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                {t('participants')}: <span className="text-text-secondary">{uniqueCount}</span>
              </div>
              <div className="relative mt-2 h-12 w-full overflow-hidden rounded-xl bg-bg-elevated ring-1 ring-border">
                {wheelStripData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs text-text-muted">
                    {t('noBets')}
                  </div>
                ) : (
                  <div className="flex h-full">
                    {wheelStripData.map((p) => (
                      <div
                        key={p.userId}
                        className="relative h-full"
                        style={{
                          width: `${p.lenPct}%`,
                          backgroundColor: p.color,
                          minWidth: p.lenPct > 1 ? undefined : '4px',
                        }}
                        title={`${p.username}: ${formatAzn(p.totalMinor)} AZN (${formatChance(p.chanceBps)}%)`}
                      />
                    ))}
                    {isRolling && round && round.bankMinor !== '0' && round.winningTicket !== null && (
                      <RollingPointer
                        progress={spinProgress}
                        winningPos={
                          Number(round.winningTicket) / Math.max(1, Number(round.bankMinor) - 1)
                        }
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Шкала ROLLING — анимация бегущей рамки */}
              {isRolling && winnerPart && spinProgress > 0.95 && (
                <div
                  className="mt-3 flex items-center justify-center rounded-lg border-2 px-4 py-2 text-sm font-semibold transition-opacity"
                  style={{ borderColor: winnerPart.color, color: winnerPart.color }}
                >
                  {t('winnerIs')}: {winnerPart.username} ({formatChance(winnerPart.chanceBps)}%)
                </div>
              )}
            </div>

            {/* Оверлей результата */}
            {result && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-bg-card/90 backdrop-blur-sm transition-opacity">
                <WinnerCard result={result} t={t} />
              </div>
            )}
          </section>

          {/* Список участников */}
          <section className="rounded-2xl border border-border bg-bg-card shadow-card">
            <header className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold text-text-primary">{t('participantsList')}</h2>
              <span className="text-xs text-text-muted">{t('chance')}</span>
            </header>
            {participants.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-text-muted">
                {t('noBets')}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {participants.map((p) => (
                  <ParticipantRow
                    key={p.userId}
                    p={p}
                    isMe={p.userId === currentUserId}
                    isWinner={isCompleted && p.userId === round?.winnerId}
                    chanceLabel={t('chance')}
                  />
                ))}
              </ul>
            )}
          </section>

          {/* Provably fair */}
          {round && (
            <section className="rounded-2xl border border-border bg-bg-card p-5 shadow-card">
              <h2 className="mb-3 text-sm font-semibold text-text-primary">{t('fair.title')}</h2>
              <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-text-muted">{t('fair.serverSeedHash')}</dt>
                  <dd className="mt-0.5 break-all font-mono text-text-secondary">{round.serverSeedHash}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">{t('fair.publicSeed')}</dt>
                  <dd className="mt-0.5 break-all font-mono text-text-secondary">{round.publicSeed ?? '—'}</dd>
                </div>
                {round.serverSeed && (
                  <div className="sm:col-span-2">
                    <dt className="text-text-muted">{t('fair.serverSeed')}</dt>
                    <dd className="mt-0.5 break-all font-mono text-text-secondary">{round.serverSeed}</dd>
                  </div>
                )}
                {round.winningTicket !== null && (
                  <div>
                    <dt className="text-text-muted">{t('fair.winningTicket')}</dt>
                    <dd className="mt-0.5 font-mono text-text-secondary">
                      #{round.winningTicket} / {bankBig.toString()}
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          )}
        </div>

        {/* ─── ПРАВАЯ КОЛОНКА ─── */}
        <aside className="flex flex-col gap-5">
          {/* Bet panel */}
          <section className="rounded-2xl border border-border bg-bg-card p-5 shadow-card">
            <h2 className="text-sm font-semibold text-text-primary">{t('bet.title')}</h2>

            <div className="mt-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                {t('bet.amount')}
              </label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-text-muted">
                  AZN
                </span>
                <input
                  type="number"
                  className="w-full rounded-lg border border-border bg-bg-elevated py-2.5 pl-12 pr-3 text-right font-mono text-base text-text-primary focus:border-brand focus:outline-none"
                  value={betInput}
                  min={Number(limits.minBetMinor) / 100}
                  max={Number(limits.maxBetMinor) / 100}
                  step={0.01}
                  onChange={(e) => setBetInput(e.target.value)}
                  disabled={!isOpen || submitting}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                {[0.5, 2, '½', '×2', 'min', 'max'].map((label) => (
                  <button
                    key={String(label)}
                    type="button"
                    onClick={() => {
                      if (label === 'min') setBetInput((Number(limits.minBetMinor) / 100).toFixed(2));
                      else if (label === 'max') setBetInput((Number(limits.maxBetMinor) / 100).toFixed(2));
                      else if (label === '½') adjustBet((n) => n / 2);
                      else if (label === '×2') adjustBet((n) => n * 2);
                      else if (typeof label === 'number') adjustBet((n) => n + label);
                    }}
                    className="rounded-md border border-border bg-bg-elevated px-2 py-1 font-mono text-text-secondary transition-colors hover:bg-bg-card-hover"
                    disabled={!isOpen || submitting}
                  >
                    {typeof label === 'number' ? `+${label}` : label}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-xs text-text-muted">
                {t('bet.limits', {
                  min: formatAzn(limits.minBetMinor),
                  max: formatAzn(limits.maxBetMinor),
                })}
              </div>
              {isAuthed && (
                <div className="mt-1 text-xs text-text-muted">
                  {t('bet.balance')}: <span className="font-mono text-text-secondary">{formatAzn(balance ?? '0')} AZN</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => void handleBet()}
              disabled={!isOpen || submitting}
              className={cn(
                'mt-4 w-full rounded-xl px-4 py-3 text-sm font-bold transition-all',
                isOpen && !submitting
                  ? 'bg-brand text-bg shadow-[0_0_20px_rgba(0,255,136,0.25)] hover:brightness-110 active:scale-[0.98]'
                  : 'cursor-not-allowed bg-bg-elevated text-text-muted',
              )}
            >
              {submitting ? t('bet.placing') : isAuthed ? t('bet.placeBet') : t('bet.loginToBet')}
            </button>

            {isAuthed && myParticipant && (
              <div className="mt-4 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">{t('bet.yourStake')}</span>
                  <span className="font-mono font-semibold text-brand">{formatAzn(myStake)} AZN</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-text-secondary">{t('bet.yourChance')}</span>
                  <span className="font-mono font-semibold text-brand">{formatChance(myChanceBps)}%</span>
                </div>
              </div>
            )}
          </section>

          {/* История */}
          <section className="rounded-2xl border border-border bg-bg-card shadow-card">
            <header className="border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold text-text-primary">{t('history.title')}</h2>
            </header>
            {history.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-text-muted">{t('history.empty')}</div>
            ) : (
              <ul className="max-h-[420px] divide-y divide-border overflow-y-auto">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center gap-3 px-5 py-2.5 text-xs">
                    <div
                      className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-bg-elevated"
                      style={{ outline: '2px solid', outlineColor: h.participants.find((p) => p.userId === h.winnerId)?.color ?? 'transparent' }}
                    >
                      {h.winnerAvatarUrl ? (
                        <Image src={h.winnerAvatarUrl} alt="" width={28} height={28} className="h-full w-full object-cover" />
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
                      <div className="font-mono font-semibold text-success">+{formatAzn(h.payoutMinor)}</div>
                      <div className="font-mono text-text-muted">{t('history.bank')}: {formatAzn(h.bankMinor)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function RollingPointer({
  progress,
  winningPos,
}: {
  progress: number;
  winningPos: number; // 0..1
}): JSX.Element {
  // Полная анимация: бегаем 4 полных круга, затем плавно тормозим на winningPos.
  // easeOutCubic для замедления.
  const eased = 1 - Math.pow(1 - progress, 3);
  const totalLaps = 4;
  const pos = ((eased * totalLaps + winningPos) % 1) * 100;
  return (
    <div
      className="pointer-events-none absolute top-0 bottom-0 z-10 w-[3px] bg-text-primary"
      style={{
        left: `${pos}%`,
        boxShadow: '0 0 8px rgba(255,255,255,0.7)',
      }}
    />
  );
}

function ParticipantRow({
  p,
  isMe,
  isWinner,
  chanceLabel,
}: {
  p: ClassicParticipantDto;
  isMe: boolean;
  isWinner: boolean;
  chanceLabel: string;
}): JSX.Element {
  return (
    <li
      className={cn(
        'flex items-center gap-3 px-5 py-2.5 transition-colors',
        isWinner && 'bg-brand/8',
        isMe && !isWinner && 'bg-bg-elevated/40',
      )}
    >
      <div
        className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-bg-elevated"
        style={{ outline: '2px solid', outlineColor: p.color }}
      >
        {p.avatarUrl ? (
          <Image src={p.avatarUrl} alt={p.username} width={36} height={36} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-text-secondary">
            {p.username.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 truncate">
          <span className="truncate text-sm font-medium text-text-primary">{p.username}</span>
          {isMe && <span className="rounded bg-brand/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-brand">you</span>}
          {isWinner && <span className="rounded bg-success/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-success">win</span>}
        </div>
        <div className="text-xs text-text-muted">{p.betsCount} bets</div>
      </div>
      <div className="text-right">
        <div className="font-mono text-sm text-text-primary">{formatAzn(p.totalMinor)}</div>
        <div className="font-mono text-xs" style={{ color: p.color }}>
          {formatChance(p.chanceBps)}% {chanceLabel.toLowerCase()}
        </div>
      </div>
    </li>
  );
}

function WinnerCard({ result, t }: { result: ResultInfo; t: ReturnType<typeof useTranslations> }): JSX.Element {
  return (
    <div className={cn(
      'flex flex-col items-center gap-2 rounded-2xl px-8 py-6 ring-2',
      result.isMe ? 'bg-success/10 ring-success' : 'bg-bg-elevated ring-border',
    )}>
      <div className="h-16 w-16 overflow-hidden rounded-full ring-2 ring-text-primary/20">
        {result.winnerAvatarUrl ? (
          <Image src={result.winnerAvatarUrl} alt="" width={64} height={64} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xl font-bold text-text-secondary">
            {(result.winnerUsername ?? '?').slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <div className="text-base font-semibold text-text-primary">
        {result.isMe ? t('youWon') : t('winnerIs')}
      </div>
      <div className="text-lg font-bold text-text-primary">{result.winnerUsername ?? '—'}</div>
      <div className="text-2xl font-extrabold font-mono text-success">+{formatAzn(result.payoutMinor)} AZN</div>
    </div>
  );
}
