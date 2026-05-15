'use client';

import { useState, useTransition } from 'react';
import { adminApi } from '../../../lib/api/admin';

type RouletteColor = 'RED' | 'GREEN' | 'BLACK';

const COLOR_OPTIONS: { value: RouletteColor | ''; label: string }[] = [
  { value: '', label: 'Авто (случайно)' },
  { value: 'RED', label: 'Красный' },
  { value: 'GREEN', label: 'Зелёный' },
  { value: 'BLACK', label: 'Чёрный' },
];

export function RouletteControls({
  currentForcedColor,
  currentHouseEdgePct,
}: {
  currentForcedColor: string;
  currentHouseEdgePct: number;
}) {
  const [forcedColor, setForcedColor] = useState(currentForcedColor);
  const [houseEdge, setHouseEdge] = useState(currentHouseEdgePct);
  const [saved, setSaved] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const saveForced = (): void => {
    startTransition(async () => {
      await adminApi.settings.set('roulette.forced_color', forcedColor);
      setSaved('Принудительный цвет сохранён');
      setTimeout(() => setSaved(null), 3000);
    });
  };

  const saveEdge = (): void => {
    startTransition(async () => {
      await adminApi.settings.set('roulette.house_edge_pct', houseEdge);
      setSaved(`Целевой GGR ${houseEdge}% сохранён`);
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

      {/* House edge % slider */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h3 className="text-sm font-semibold text-ink-700 mb-1">Целевой GGR казино</h3>
        <p className="text-xs text-ink-500 mb-4">
          Желаемый доход от оборота. Если фактический GGR% ниже — срабатывает предупреждение антиминуса.
        </p>
        <div className="flex items-center gap-4 mb-3">
          <input
            type="range"
            min={0}
            max={30}
            step={0.5}
            value={houseEdge}
            onChange={(e) => setHouseEdge(parseFloat(e.target.value))}
            className="flex-1 accent-primary"
          />
          <span className="w-14 text-right font-mono text-lg font-bold text-primary">
            {houseEdge.toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between text-xs text-ink-400 mb-4">
          <span>0% (без цели)</span>
          <span>15%</span>
          <span>30%</span>
        </div>
        <button
          onClick={saveEdge}
          disabled={isPending}
          className="w-full rounded-xl bg-primary py-2 text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          Сохранить {houseEdge.toFixed(1)}%
        </button>
      </div>

      {saved && (
        <div className="md:col-span-2 rounded-xl bg-success/10 border border-success/30 px-4 py-2 text-sm text-success font-medium">
          ✓ {saved}
        </div>
      )}
    </div>
  );
}
