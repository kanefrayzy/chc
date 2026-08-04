'use client';

import { useRef, useState, useTransition } from 'react';
import { adminApi } from '../../../lib/api/admin';

const ICON_CONFIGS = [
  { key: 'mines.icon_url.gem', label: 'Кристалл' },
  { key: 'mines.icon_url.bomb', label: 'Бомба' },
] as const;

function IconUploadItem({
  config,
  initialUrl,
  onSaved,
}: {
  config: (typeof ICON_CONFIGS)[number];
  initialUrl: string;
  onSaved: (msg: string) => void;
}): JSX.Element {
  const [url, setUrl] = useState(initialUrl);
  const [uploading, startUpload] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    startUpload(async () => {
      const row = await adminApi.settings.uploadImage(config.key, file);
      const newUrl = String(row.value ?? '');
      setUrl(newUrl);
      onSaved(`Иконка «${config.label}» сохранена`);
    });
    e.target.value = '';
  };

  const handleRemove = (): void => {
    startUpload(async () => {
      await adminApi.settings.set(config.key, '');
      setUrl('');
      onSaved(`Иконка «${config.label}» удалена`);
    });
  };

  return (
    <div className="flex items-center gap-4 py-3 border-b border-border last:border-b-0">
      <span className="w-24 shrink-0 text-sm font-medium text-ink-700">{config.label}</span>

      <div className="h-10 w-10 shrink-0 rounded-lg border border-border bg-ink-50 overflow-hidden flex items-center justify-center">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={config.label} className="h-full w-full object-contain" />
        ) : (
          <span className="text-xs text-ink-400">—</span>
        )}
      </div>

      <div className="flex gap-2 ml-auto">
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-50 transition-colors"
        >
          {uploading ? 'Загрузка…' : url ? 'Заменить' : 'Загрузить'}
        </button>
        {url && (
          <button
            type="button"
            disabled={uploading}
            onClick={handleRemove}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
          >
            Удалить
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}

export interface MinesControlsProps {
  currentEnabled: boolean;
  currentHouseEdgeBps: number;
  currentMinBetMinor: string;
  currentMaxBetMinor: string;
  currentIconGem: string;
  currentIconBomb: string;
}

export function MinesControls({
  currentEnabled,
  currentHouseEdgeBps,
  currentMinBetMinor,
  currentMaxBetMinor,
  currentIconGem,
  currentIconBomb,
}: MinesControlsProps): JSX.Element {
  const [enabled, setEnabled] = useState(currentEnabled);
  const [edgeBps, setEdgeBps] = useState(currentHouseEdgeBps);
  const [minBetAzn, setMinBetAzn] = useState((Number(currentMinBetMinor) / 100).toString());
  const [maxBetAzn, setMaxBetAzn] = useState((Number(currentMaxBetMinor) / 100).toString());
  const [saved, setSaved] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const show = (msg: string): void => {
    setSaved(msg);
    setTimeout(() => setSaved(null), 3000);
  };

  const toggleEnabled = (): void => {
    startTransition(async () => {
      const next = !enabled;
      await adminApi.settings.set('gameplay.mines_enabled', next);
      setEnabled(next);
      show(next ? 'Mines включён' : 'Mines выключен');
    });
  };

  const saveEdge = (): void => {
    startTransition(async () => {
      const clamped = Math.max(0, Math.min(9999, Math.round(edgeBps)));
      await adminApi.settings.set('mines.house_edge_bps', clamped);
      setEdgeBps(clamped);
      show(`House edge ${(clamped / 100).toFixed(2)}% сохранён`);
    });
  };

  const saveLimits = (): void => {
    startTransition(async () => {
      const minMinor = Math.max(1, Math.round(Number(minBetAzn) * 100));
      const maxMinor = Math.max(minMinor, Math.round(Number(maxBetAzn) * 100));
      await adminApi.settings.set('mines.min_bet_minor', String(minMinor));
      await adminApi.settings.set('mines.max_bet_minor', String(maxMinor));
      setMinBetAzn((minMinor / 100).toString());
      setMaxBetAzn((maxMinor / 100).toString());
      show('Лимиты ставок сохранены');
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      {/* Enable / disable */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h3 className="text-sm font-semibold text-ink-700 mb-1">Доступность игры</h3>
        <p className="text-xs text-ink-500 mb-4">
          Полностью выключает Mines для всех пользователей. Активные партии не отменяются.
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

      {/* House edge slider */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h3 className="text-sm font-semibold text-ink-700 mb-1">House edge</h3>
        <p className="text-xs text-ink-500 mb-4">
          Скрытое преимущество казино. Чем выше — тем сильнее срезается множитель после первого
          открытия клетки. Рекомендуемое значение: 1–3% (100–300 bps).
        </p>
        <div className="flex items-center gap-4 mb-3">
          <input
            type="range"
            min={0}
            max={1000}
            step={25}
            value={edgeBps}
            onChange={(e) => setEdgeBps(parseInt(e.target.value, 10))}
            className="flex-1 accent-primary"
          />
          <span className="w-20 text-right font-mono text-lg font-bold text-primary">
            {(edgeBps / 100).toFixed(2)}%
          </span>
        </div>
        <div className="flex justify-between text-xs text-ink-400 mb-4">
          <span>0%</span>
          <span>5%</span>
          <span>10%</span>
        </div>
        <button
          onClick={saveEdge}
          disabled={isPending}
          className="w-full rounded-xl bg-primary py-2 text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          Сохранить {edgeBps} bps
        </button>
      </div>

      {/* Bet limits */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h3 className="text-sm font-semibold text-ink-700 mb-1">Лимиты ставок</h3>
        <p className="text-xs text-ink-500 mb-4">Минимум и максимум одной ставки в AZN.</p>
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

      {/* Icons */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h3 className="text-sm font-semibold text-ink-700 mb-1">Иконки клеток</h3>
        <p className="text-xs text-ink-500 mb-4">
          PNG/JPEG/WEBP до 5 МБ. Если иконка не загружена — используется встроенный SVG.
        </p>
        <div>
          <IconUploadItem
            config={ICON_CONFIGS[0]}
            initialUrl={currentIconGem}
            onSaved={show}
          />
          <IconUploadItem
            config={ICON_CONFIGS[1]}
            initialUrl={currentIconBomb}
            onSaved={show}
          />
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
