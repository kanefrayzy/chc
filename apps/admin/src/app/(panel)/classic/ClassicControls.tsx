'use client';

import { useState, useTransition } from 'react';
import { adminApi } from '../../../lib/api/admin';

export interface ClassicControlsProps {
  currentEnabled: boolean;
  currentCommissionBps: number;
  currentMinBetMinor: string;
  currentMaxBetMinor: string;
  currentRoundDurationSec: number;
  currentRollingDurationSec: number;
  currentMinPlayersToStart: number;
  currentForcedWinnerUserId: string;
}

export function ClassicControls({
  currentEnabled,
  currentCommissionBps,
  currentMinBetMinor,
  currentMaxBetMinor,
  currentRoundDurationSec,
  currentRollingDurationSec,
  currentMinPlayersToStart,
  currentForcedWinnerUserId,
}: ClassicControlsProps): JSX.Element {
  const [enabled, setEnabled] = useState(currentEnabled);
  const [commissionBps, setCommissionBps] = useState(currentCommissionBps);
  const [minBetAzn, setMinBetAzn] = useState((Number(currentMinBetMinor) / 100).toString());
  const [maxBetAzn, setMaxBetAzn] = useState((Number(currentMaxBetMinor) / 100).toString());
  const [roundSec, setRoundSec] = useState(currentRoundDurationSec);
  const [rollingSec, setRollingSec] = useState(currentRollingDurationSec);
  const [minPlayers, setMinPlayers] = useState(currentMinPlayersToStart);
  const [forcedUserId, setForcedUserId] = useState(currentForcedWinnerUserId);
  const [saved, setSaved] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const show = (msg: string): void => {
    setSaved(msg);
    setTimeout(() => setSaved(null), 3000);
  };

  const toggleEnabled = (): void => {
    startTransition(async () => {
      const next = !enabled;
      await adminApi.settings.set('gameplay.jackpot_enabled', next);
      setEnabled(next);
      show(next ? 'Классический включён' : 'Классический выключен');
    });
  };

  const saveCommission = (): void => {
    startTransition(async () => {
      const clamped = Math.max(0, Math.min(9999, Math.round(commissionBps)));
      await adminApi.settings.set('classic.commission_bps', clamped);
      setCommissionBps(clamped);
      show(`Комиссия ${(clamped / 100).toFixed(2)}% сохранена`);
    });
  };

  const saveLimits = (): void => {
    startTransition(async () => {
      const minMinor = Math.max(1, Math.round(Number(minBetAzn) * 100));
      const maxMinor = Math.max(minMinor, Math.round(Number(maxBetAzn) * 100));
      await adminApi.settings.set('classic.min_bet_minor', String(minMinor));
      await adminApi.settings.set('classic.max_bet_minor', String(maxMinor));
      setMinBetAzn((minMinor / 100).toString());
      setMaxBetAzn((maxMinor / 100).toString());
      show('Лимиты ставок сохранены');
    });
  };

  const saveTiming = (): void => {
    startTransition(async () => {
      const r = Math.max(5, Math.min(600, Math.round(roundSec)));
      const ro = Math.max(2, Math.min(30, Math.round(rollingSec)));
      const mp = Math.max(2, Math.min(50, Math.round(minPlayers)));
      await adminApi.settings.set('classic.round_duration_sec', r);
      await adminApi.settings.set('classic.rolling_duration_sec', ro);
      await adminApi.settings.set('classic.min_players_to_start', mp);
      setRoundSec(r);
      setRollingSec(ro);
      setMinPlayers(mp);
      show('Тайминг сохранён');
    });
  };

  const saveForced = (): void => {
    startTransition(async () => {
      await adminApi.settings.set('classic.forced_winner_user_id', forcedUserId.trim());
      show(forcedUserId.trim() ? 'Принудительный победитель установлен' : 'Принудительный победитель сброшен');
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      {/* Enable / disable */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h3 className="text-sm font-semibold text-ink-700 mb-1">Доступность игры</h3>
        <p className="text-xs text-ink-500 mb-4">
          Полностью выключает игру «Классический» для всех. Активный раунд продолжит работу до завершения.
        </p>
        <button
          type="button"
          onClick={toggleEnabled}
          disabled={isPending}
          className={`w-full rounded-xl py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50 ${
            enabled ? 'bg-success hover:opacity-80' : 'bg-danger hover:opacity-80'
          }`}
        >
          {enabled ? 'Включено — выключить' : 'Выключено — включить'}
        </button>
      </div>

      {/* Commission */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h3 className="text-sm font-semibold text-ink-700 mb-1">Комиссия казино</h3>
        <p className="text-xs text-ink-500 mb-4">
          Доля общего банка, удерживаемая казино. Например, 700 bps = 7%. Рекомендуем 5–10%.
        </p>
        <div className="flex items-center gap-4 mb-3">
          <input
            type="range"
            min={0}
            max={2500}
            step={25}
            value={commissionBps}
            onChange={(e) => setCommissionBps(parseInt(e.target.value, 10))}
            className="flex-1 accent-primary"
          />
          <span className="w-20 text-right font-mono text-lg font-bold text-primary">
            {(commissionBps / 100).toFixed(2)}%
          </span>
        </div>
        <button
          onClick={saveCommission}
          disabled={isPending}
          className="w-full rounded-xl bg-primary py-2 text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          Сохранить {commissionBps} bps
        </button>
      </div>

      {/* Bet limits */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h3 className="text-sm font-semibold text-ink-700 mb-1">Лимиты ставок</h3>
        <p className="text-xs text-ink-500 mb-4">
          Минимум и максимум одной ставки в AZN. Максимум общего банка ограничен ~21 000 000 AZN.
        </p>
        <div className="flex items-center gap-3 mb-3">
          <label className="flex-1">
            <span className="block text-xs text-ink-500 mb-1">Мин. ставка, AZN</span>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={minBetAzn}
              onChange={(e) => setMinBetAzn(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="flex-1">
            <span className="block text-xs text-ink-500 mb-1">Макс. ставка, AZN</span>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={maxBetAzn}
              onChange={(e) => setMaxBetAzn(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
        </div>
        <button
          onClick={saveLimits}
          disabled={isPending}
          className="w-full rounded-xl bg-primary py-2 text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          Сохранить лимиты
        </button>
      </div>

      {/* Timing */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h3 className="text-sm font-semibold text-ink-700 mb-1">Тайминг раунда</h3>
        <p className="text-xs text-ink-500 mb-4">
          Длительность отсчёта (после набора минимального числа игроков), длительность анимации барабана и минимум игроков для старта.
        </p>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <label>
            <span className="block text-xs text-ink-500 mb-1">Отсчёт, сек</span>
            <input
              type="number"
              min={5}
              max={600}
              value={roundSec}
              onChange={(e) => setRoundSec(parseInt(e.target.value, 10) || 0)}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label>
            <span className="block text-xs text-ink-500 mb-1">Барабан, сек</span>
            <input
              type="number"
              min={2}
              max={30}
              value={rollingSec}
              onChange={(e) => setRollingSec(parseInt(e.target.value, 10) || 0)}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label>
            <span className="block text-xs text-ink-500 mb-1">Мин. игроков</span>
            <input
              type="number"
              min={2}
              max={50}
              value={minPlayers}
              onChange={(e) => setMinPlayers(parseInt(e.target.value, 10) || 0)}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
        </div>
        <button
          onClick={saveTiming}
          disabled={isPending}
          className="w-full rounded-xl bg-primary py-2 text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          Сохранить тайминг
        </button>
      </div>

      {/* Forced winner */}
      <div className="md:col-span-2 rounded-2xl border border-orange-200 bg-orange-50/50 p-5 shadow-card">
        <h3 className="text-sm font-semibold text-orange-900 mb-1">Принудительный победитель (debug)</h3>
        <p className="text-xs text-orange-700 mb-4">
          Если задан ID пользователя — текущий или ближайший раунд завершится с победой этого игрока (только если он сделал ставку). После розыгрыша значение автоматически очищается. Используйте только для тестов.
        </p>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="ID пользователя"
            value={forcedUserId}
            onChange={(e) => setForcedUserId(e.target.value)}
            className="flex-1 rounded-xl border border-orange-300 bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-orange-400 font-mono"
          />
          <button
            onClick={saveForced}
            disabled={isPending}
            className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            Применить
          </button>
        </div>
      </div>

      {saved && (
        <div className="md:col-span-2 rounded-xl bg-success/10 border border-success/30 px-4 py-2 text-sm text-success font-medium">
          {saved}
        </div>
      )}
    </div>
  );
}
