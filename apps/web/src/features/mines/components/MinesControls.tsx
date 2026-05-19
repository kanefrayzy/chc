'use client';

import { useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@chcgreen/ui';
import { parseAmountToMinor } from '@/features/deposits/components/AmountInput';

export interface MinesControlsProps {
  /** Активна ли сейчас игра — в этом случае контролы выбора залочены. */
  isGameActive: boolean;
  isBusy: boolean;
  isAuthed: boolean;
  balanceMinor: string | null;

  amount: string;
  onAmountChange: (v: string) => void;

  mineCount: number;
  onMineCountChange: (n: number) => void;

  minBetMinor: bigint;
  maxBetMinor: bigint;
  minMines: number;
  maxMines: number;

  /** Текущий множитель × 10000 (только когда игра активна). */
  multiplierBps: number;
  /** Текущая возможная выплата в minor units (только когда игра активна). */
  currentPayoutMinor: string;
  /** Сколько клеток открыто — для блокировки cashout до первой клетки. */
  revealedCount: number;

  onStart: () => void;
  onCashout: () => void;
}

const MINE_OPTIONS: number[] = [1, 3, 5, 8, 10, 15, 20, 24];

export function MinesControls({
  isGameActive,
  isBusy,
  isAuthed,
  balanceMinor,
  amount,
  onAmountChange,
  mineCount,
  onMineCountChange,
  minBetMinor,
  maxBetMinor,
  minMines,
  maxMines,
  multiplierBps,
  currentPayoutMinor,
  revealedCount,
  onStart,
  onCashout,
}: MinesControlsProps): JSX.Element {
  const t = useTranslations('mines');
  const balanceAzn = balanceMinor ? Number(balanceMinor) / 100 : 0;
  const maxAzn = Number(maxBetMinor) / 100;
  const minAzn = Number(minBetMinor) / 100;

  const adjust = (fn: (cur: number) => number): void => {
    const cur = parseFloat(amount) || 0;
    const next = Math.max(minAzn, Math.min(maxAzn, fn(cur)));
    onAmountChange(next.toFixed(2));
  };

  const validAmount = useMemo(() => {
    const minor = parseAmountToMinor(amount);
    if (minor === null) return false;
    return minor >= minBetMinor && minor <= maxBetMinor && minor <= BigInt(balanceMinor ?? '0');
  }, [amount, minBetMinor, maxBetMinor, balanceMinor]);

  const mineOptions = useMemo(
    () => MINE_OPTIONS.filter((m) => m >= minMines && m <= maxMines),
    [minMines, maxMines],
  );

  // Если активная игра уже определила mineCount — синхронизируемся.
  useEffect(() => {
    // Игра активна — UI отображает её mineCount, изменения запрещены. Ничего не делаем.
  }, [mineCount]);

  const mult = (multiplierBps / 10_000).toFixed(4);
  const payoutAzn = (Number(currentPayoutMinor) / 100).toFixed(2);

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-bg-card p-4">
      {/* Сумма ставки */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-muted">
          {t('controls.amountLabel')}
        </label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-text-muted">AZN</span>
            <input
              type="number"
              inputMode="decimal"
              min={minAzn}
              max={maxAzn}
              step="0.01"
              value={amount}
              disabled={isGameActive || !isAuthed || isBusy}
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-border bg-bg-elevated pl-12 pr-3 py-3 text-base font-mono text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-50"
            />
          </div>
          <span className="whitespace-nowrap text-xs text-text-muted">
            {t('controls.balance')}: <span className="font-mono text-text-secondary">{balanceAzn.toFixed(2)}</span>
          </span>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
          {[1, 5, 10, 50].map((v) => (
            <button
              key={v}
              type="button"
              disabled={isGameActive || !isAuthed || isBusy}
              onClick={() => adjust((c) => c + v)}
              className="rounded-lg border border-border bg-bg-elevated py-2 text-sm font-semibold text-text-secondary transition hover:border-brand hover:text-brand active:scale-95 disabled:opacity-40"
            >
              +{v}
            </button>
          ))}
          <button
            type="button"
            disabled={isGameActive || !isAuthed || isBusy}
            onClick={() => adjust((c) => c / 2)}
            className="rounded-lg border border-border bg-bg-elevated py-2 text-sm font-semibold text-text-secondary transition hover:border-brand hover:text-brand active:scale-95 disabled:opacity-40"
          >
            ½
          </button>
          <button
            type="button"
            disabled={isGameActive || !isAuthed || isBusy}
            onClick={() => adjust((c) => c * 2)}
            className="rounded-lg border border-border bg-bg-elevated py-2 text-sm font-semibold text-text-secondary transition hover:border-brand hover:text-brand active:scale-95 disabled:opacity-40"
          >
            ×2
          </button>
        </div>
      </div>

      {/* Кол-во мин */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-muted">
          {t('controls.mineCountLabel')} <span className="text-brand">{mineCount}</span>
        </label>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
          {mineOptions.map((m) => (
            <button
              key={m}
              type="button"
              disabled={isGameActive || isBusy || !isAuthed}
              onClick={() => onMineCountChange(m)}
              className={cn(
                'rounded-lg border py-2 text-sm font-semibold transition active:scale-95',
                mineCount === m
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-border bg-bg-elevated text-text-secondary hover:border-brand/60 hover:text-brand',
                (isGameActive || isBusy || !isAuthed) && 'opacity-50',
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Кнопка действия */}
      {isGameActive ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-sm">
            <span className="text-text-muted">{t('controls.multiplier')}</span>
            <span className="font-mono text-base font-bold text-brand">×{mult}</span>
          </div>
          <button
            type="button"
            disabled={isBusy || revealedCount === 0}
            onClick={onCashout}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-brand to-[#00b272] py-3.5 text-base font-bold uppercase tracking-wide text-[#06241a] shadow-[0_4px_0_rgba(0,0,0,0.25),0_0_30px_rgba(0,255,140,0.35)] transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
            )}
          >
            <span>{t('controls.cashout')}</span>
            <span className="font-mono">{payoutAzn} AZN</span>
          </button>
          {revealedCount === 0 ? (
            <p className="text-center text-xs text-text-muted">{t('controls.openAtLeastOne')}</p>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          disabled={!isAuthed || isBusy || !validAmount}
          onClick={onStart}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-brand to-[#00b272] py-3.5 text-base font-bold uppercase tracking-wide text-[#06241a] shadow-[0_4px_0_rgba(0,0,0,0.25),0_0_30px_rgba(0,255,140,0.35)] transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
          )}
        >
          {isAuthed ? t('controls.start') : t('controls.loginRequired')}
        </button>
      )}
    </div>
  );
}
