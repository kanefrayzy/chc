'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@chcgreen/ui';
import { parseAmountToMinor } from '@/features/wallet/components/AmountField';

export type MinesMode = 'manual' | 'auto';

export interface MinesAutoConfig {
  /** Кол-во раундов (0 = бесконечно). */
  betsCount: number;
  /** Стратегия после выигрыша. */
  onWin: 'reset' | 'increase';
  /** Процент увеличения после выигрыша. */
  winPct: number;
  /** Стратегия после проигрыша. */
  onLoss: 'reset' | 'increase';
  /** Процент увеличения после проигрыша. */
  lossPct: number;
  /** Стоп при достижении суммарной прибыли (AZN). 0 — выкл. */
  stopWinAmount: string;
  /** Стоп при достижении суммарного убытка (AZN). 0 — выкл. */
  stopLossAmount: string;
}

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
  totalTiles: number;

  /** Текущий множитель × 10000 (только когда игра активна). */
  multiplierBps: number;
  /** Текущая возможная выплата в minor units (только когда игра активна). */
  currentPayoutMinor: string;
  /** Сколько клеток открыто — для блокировки cashout до первой клетки. */
  revealedCount: number;

  onStart: () => void;
  onCashout: () => void;

  /** Текущий режим: ручной/авто. */
  mode: MinesMode;
  onModeChange: (m: MinesMode) => void;
  /** Параметры авто-режима. */
  autoConfig: MinesAutoConfig;
  onAutoConfigChange: (next: MinesAutoConfig) => void;
  /** Идут ли сейчас автоставки. */
  autoRunning: boolean;
  /** Прогресс автосессии (для подписи кнопки). */
  autoRoundsDone: number;
  onAutoStart: () => void;
  onAutoStop: () => void;
  /** Сколько клеток выбрано для авто-комбинации. */
  autoSelectedCount: number;
  /** Сбросить выбор клеток. */
  onAutoSelectionClear: () => void;
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
  totalTiles,
  multiplierBps,
  currentPayoutMinor,
  revealedCount,
  onStart,
  onCashout,
  mode,
  onModeChange,
  autoConfig,
  onAutoConfigChange,
  autoRunning,
  autoRoundsDone,
  onAutoStart,
  onAutoStop,
  autoSelectedCount,
  onAutoSelectionClear,
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

  // Блокируем переключение режима когда есть активная партия или идут автоставки.
  const modeLocked = isGameActive || autoRunning;
  // Контролы залочены в авто-режиме во время выполнения автосессии.
  const autoControlsDisabled = autoRunning || isGameActive || !isAuthed;
  const safeTiles = Math.max(1, totalTiles - mineCount);

  const setAutoField = <K extends keyof MinesAutoConfig>(k: K, v: MinesAutoConfig[K]): void => {
    onAutoConfigChange({ ...autoConfig, [k]: v });
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-bg-card p-4">
      {/* Переключатель режимов */}
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-bg-elevated p-1">
        {(['manual', 'auto'] as const).map((m) => (
          <button
            key={m}
            type="button"
            disabled={modeLocked}
            onClick={() => onModeChange(m)}
            className={cn(
              'rounded-lg py-2 text-sm font-semibold transition',
              mode === m
                ? 'bg-bg-card text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary',
              modeLocked && 'cursor-not-allowed opacity-60',
            )}
          >
            {m === 'manual' ? t('controls.modeManual') : t('controls.modeAuto')}
          </button>
        ))}
      </div>

      {/* Сумма ставки (общая для обоих режимов) */}
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
              disabled={isGameActive || !isAuthed || isBusy || autoRunning}
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
              disabled={isGameActive || !isAuthed || isBusy || autoRunning}
              onClick={() => adjust((c) => c + v)}
              className="rounded-lg border border-border bg-bg-elevated py-2 text-sm font-semibold text-text-secondary transition hover:border-brand hover:text-brand active:scale-95 disabled:opacity-40"
            >
              +{v}
            </button>
          ))}
          <button
            type="button"
            disabled={isGameActive || !isAuthed || isBusy || autoRunning}
            onClick={() => adjust((c) => c / 2)}
            className="rounded-lg border border-border bg-bg-elevated py-2 text-sm font-semibold text-text-secondary transition hover:border-brand hover:text-brand active:scale-95 disabled:opacity-40"
          >
            ½
          </button>
          <button
            type="button"
            disabled={isGameActive || !isAuthed || isBusy || autoRunning}
            onClick={() => adjust((c) => c * 2)}
            className="rounded-lg border border-border bg-bg-elevated py-2 text-sm font-semibold text-text-secondary transition hover:border-brand hover:text-brand active:scale-95 disabled:opacity-40"
          >
            ×2
          </button>
        </div>
      </div>

      {/* Кол-во мин (общее) */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-muted">
          {t('controls.mineCountLabel')} <span className="text-brand">{mineCount}</span>
        </label>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
          {mineOptions.map((m) => (
            <button
              key={m}
              type="button"
              disabled={isGameActive || isBusy || !isAuthed || autoRunning}
              onClick={() => onMineCountChange(m)}
              className={cn(
                'rounded-lg border py-2 text-sm font-semibold transition active:scale-95',
                mineCount === m
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-border bg-bg-elevated text-text-secondary hover:border-brand/60 hover:text-brand',
                (isGameActive || isBusy || !isAuthed || autoRunning) && 'opacity-50',
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {mode === 'manual' ? (
        // ───────────── Ручной режим ─────────────
        isGameActive ? (
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
        )
      ) : (
        // ───────────── Авто-режим ─────────────
        <div className="space-y-3">
          {/* Выбранные клетки */}
          <div>
            <label className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-text-muted">
              <span>{t('controls.selectedTiles')}</span>
              <span className="font-mono text-text-secondary">
                {autoSelectedCount} / {safeTiles}
              </span>
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-lg border border-border bg-bg-elevated px-3 py-2.5 text-xs text-text-muted">
                {autoSelectedCount === 0
                  ? t('controls.selectTilesHint')
                  : t('controls.selectedTilesSummary', { count: autoSelectedCount })}
              </div>
              <button
                type="button"
                disabled={autoControlsDisabled || autoSelectedCount === 0}
                onClick={onAutoSelectionClear}
                className="rounded-lg border border-border bg-bg-elevated px-3 py-2.5 text-xs font-semibold text-text-secondary transition hover:border-danger/60 hover:text-danger disabled:opacity-50"
              >
                {t('controls.clearSelection')}
              </button>
            </div>
          </div>

          {/* Количество ставок */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-muted">
              {t('controls.betsCountLabel')}
            </label>
            <div className="relative">
              <input
                type="number"
                min={0}
                step={1}
                value={autoConfig.betsCount}
                disabled={autoControlsDisabled}
                onChange={(e) => setAutoField('betsCount', Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2.5 pr-8 text-sm font-mono text-text-primary focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-50"
              />
              {autoConfig.betsCount === 0 ? (
                <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">∞</span>
              ) : null}
            </div>
          </div>

          {/* Настройки toggle */}
          <SettingsBlock
            autoConfig={autoConfig}
            setAutoField={setAutoField}
            disabled={autoControlsDisabled}
            tLabels={{
              settings: t('controls.settings'),
              onWin: t('controls.onWin'),
              onLoss: t('controls.onLoss'),
              reset: t('controls.reset'),
              increaseBy: t('controls.increaseBy'),
              stopOnWin: t('controls.stopOnWin'),
              stopOnLoss: t('controls.stopOnLoss'),
            }}
          />

          {/* Кнопка старт/стоп */}
          {autoRunning ? (
            <button
              type="button"
              onClick={onAutoStop}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-danger to-[#a8121a] py-3.5 text-base font-bold uppercase tracking-wide text-white shadow-[0_4px_0_rgba(0,0,0,0.25)] transition hover:brightness-110 active:scale-[0.99]"
            >
              {t('controls.autoStop')}
              <span className="font-mono text-xs opacity-80">#{autoRoundsDone}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={!isAuthed || isBusy || !validAmount || isGameActive || autoSelectedCount === 0}
              onClick={onAutoStart}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-brand to-[#00b272] py-3.5 text-base font-bold uppercase tracking-wide text-[#06241a] shadow-[0_4px_0_rgba(0,0,0,0.25),0_0_30px_rgba(0,255,140,0.35)] transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
              )}
            >
              {isAuthed ? t('controls.autoStart') : t('controls.loginRequired')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SettingsBlock({
  autoConfig,
  setAutoField,
  disabled,
  tLabels,
}: {
  autoConfig: MinesAutoConfig;
  setAutoField: <K extends keyof MinesAutoConfig>(k: K, v: MinesAutoConfig[K]) => void;
  disabled: boolean;
  tLabels: {
    settings: string;
    onWin: string;
    onLoss: string;
    reset: string;
    increaseBy: string;
    stopOnWin: string;
    stopOnLoss: string;
  };
}): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-border bg-bg-elevated px-3 py-2.5 text-sm font-semibold text-text-secondary transition hover:border-brand/40 hover:text-brand"
      >
        <span>{tLabels.settings}</span>
        <span
          aria-hidden
          className={cn(
            'inline-flex h-5 w-9 items-center rounded-full border border-border bg-bg-card transition',
            open ? 'bg-brand/30 border-brand/60' : '',
          )}
        >
          <span
            className={cn(
              'h-3.5 w-3.5 rounded-full bg-text-secondary transition',
              open ? 'translate-x-[18px] bg-brand' : 'translate-x-0.5',
            )}
          />
        </span>
      </button>

      {open ? (
        <div className="mt-3 space-y-3">
          {/* При выигрыше */}
          <StrategyRow
            label={tLabels.onWin}
            strategy={autoConfig.onWin}
            pct={autoConfig.winPct}
            onStrategyChange={(s) => setAutoField('onWin', s)}
            onPctChange={(p) => setAutoField('winPct', p)}
            resetLabel={tLabels.reset}
            increaseLabel={tLabels.increaseBy}
            disabled={disabled}
          />
          {/* При проигрыше */}
          <StrategyRow
            label={tLabels.onLoss}
            strategy={autoConfig.onLoss}
            pct={autoConfig.lossPct}
            onStrategyChange={(s) => setAutoField('onLoss', s)}
            onPctChange={(p) => setAutoField('lossPct', p)}
            resetLabel={tLabels.reset}
            increaseLabel={tLabels.increaseBy}
            disabled={disabled}
          />
          {/* Стоп при выигрыше */}
          <StopRow
            label={tLabels.stopOnWin}
            value={autoConfig.stopWinAmount}
            onChange={(v) => setAutoField('stopWinAmount', v)}
            disabled={disabled}
          />
          {/* Стоп при проигрыше */}
          <StopRow
            label={tLabels.stopOnLoss}
            value={autoConfig.stopLossAmount}
            onChange={(v) => setAutoField('stopLossAmount', v)}
            disabled={disabled}
          />
        </div>
      ) : null}
    </div>
  );
}

function StrategyRow({
  label,
  strategy,
  pct,
  onStrategyChange,
  onPctChange,
  resetLabel,
  increaseLabel,
  disabled,
}: {
  label: string;
  strategy: 'reset' | 'increase';
  pct: number;
  onStrategyChange: (s: 'reset' | 'increase') => void;
  onPctChange: (p: number) => void;
  resetLabel: string;
  increaseLabel: string;
  disabled: boolean;
}): JSX.Element {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</div>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onStrategyChange('reset')}
          className={cn(
            'flex-1 rounded-lg border py-2 text-sm font-semibold transition active:scale-95',
            strategy === 'reset'
              ? 'border-brand bg-brand/10 text-brand'
              : 'border-border bg-bg-elevated text-text-secondary hover:border-brand/60 hover:text-brand',
            disabled && 'opacity-50',
          )}
        >
          {resetLabel}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onStrategyChange('increase')}
          className={cn(
            'flex-1 rounded-lg border py-2 text-sm font-semibold transition active:scale-95',
            strategy === 'increase'
              ? 'border-brand bg-brand/10 text-brand'
              : 'border-border bg-bg-elevated text-text-secondary hover:border-brand/60 hover:text-brand',
            disabled && 'opacity-50',
          )}
        >
          {increaseLabel}
        </button>
        <div className="relative w-24">
          <input
            type="number"
            min={0}
            max={1000}
            step={1}
            value={pct}
            disabled={disabled || strategy !== 'increase'}
            onChange={(e) => onPctChange(Math.max(0, Math.min(1000, Number(e.target.value) || 0)))}
            className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 pr-7 text-sm font-mono text-text-primary focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-50"
          />
          <span aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-text-muted">%</span>
        </div>
      </div>
    </div>
  );
}

function StopRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}): JSX.Element {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-text-muted">
        <span>{label}</span>
        <span className="font-mono text-text-secondary">{(Number(value) || 0).toFixed(2)} AZN</span>
      </div>
      <input
        type="number"
        min={0}
        step="0.01"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0.00"
        className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2.5 text-sm font-mono text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-50"
      />
    </div>
  );
}
