'use client';

import { useState, useTransition } from 'react';
import { adminApi } from '../../../lib/api/admin';

type RouletteColor = 'RED' | 'GREEN' | 'BLACK';

const COLOR_OPTIONS: { value: RouletteColor | ''; label: string; color: string }[] = [
  { value: '', label: 'Авто (случайно)', color: 'text-ink-500' },
  { value: 'RED', label: 'Красный', color: 'text-red-500' },
  { value: 'GREEN', label: 'Зелёный', color: 'text-green-500' },
  { value: 'BLACK', label: 'Чёрный', color: 'text-ink-900' },
];

export function RouletteControls({
  currentForcedColor,
  currentDailyTargetMinor,
}: {
  currentForcedColor: string;
  currentDailyTargetMinor: string;
}) {
  const [forcedColor, setForcedColor] = useState(currentForcedColor);
  const [dailyTarget, setDailyTarget] = useState(
    currentDailyTargetMinor ? String(Math.round(Number(currentDailyTargetMinor) / 100)) : '',
  );
  const [saved, setSaved] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const saveForced = (): void => {
    startTransition(async () => {
      await adminApi.settings.update('roulette.forced_color', forcedColor);
      setSaved('Принудительный цвет сохранён');
      setTimeout(() => setSaved(null), 3000);
    });
  };

  const saveTarget = (): void => {
    const minor = String(Math.round(parseFloat(dailyTarget || '0') * 100));
    startTransition(async () => {
      await adminApi.settings.update('roulette.daily_target_minor', minor);
      setSaved('Суточный план сохранён');
      setTimeout(() => setSaved(null), 3000);
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      {/* Force next color */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h3 className="text-sm font-semibold text-ink-700 mb-3">Следующий выигрышный цвет</h3>
        <p className="text-xs text-ink-500 mb-4">
          Задайте принудительный цвет для следующего раунда. После выпадения сбросится автоматически.
        </p>
        <div className="flex gap-3">
          <select
            value={forcedColor}
            onChange={(e) => setForcedColor(e.target.value)}
            className="flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {COLOR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={saveForced}
            disabled={isPending}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            Сохранить
          </button>
        </div>
        {forcedColor && (
          <p className="mt-2 text-xs font-medium text-orange-500">
            ⚠ Следующий раунд будет принудительно: {forcedColor}
          </p>
        )}
      </div>

      {/* Daily GGR target */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h3 className="text-sm font-semibold text-ink-700 mb-3">Суточный план GGR (₼)</h3>
        <p className="text-xs text-ink-500 mb-4">
          Укажите желаемый суточный доход казино. Если фактический GGR ниже — используйте принудительный цвет для управления.
        </p>
        <div className="flex gap-3">
          <input
            type="number"
            min="0"
            step="1"
            value={dailyTarget}
            onChange={(e) => setDailyTarget(e.target.value)}
            placeholder="0.00"
            className="flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={saveTarget}
            disabled={isPending}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            Сохранить
          </button>
        </div>
      </div>

      {saved && (
        <div className="md:col-span-2 rounded-xl bg-success/10 border border-success/30 px-4 py-2 text-sm text-success font-medium">
          ✓ {saved}
        </div>
      )}
    </div>
  );
}
