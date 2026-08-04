'use client';

import { useRef, useState, useTransition } from 'react';
import { adminApi } from '../../../lib/api/admin';

type RouletteColor = 'RED' | 'GREEN' | 'BLACK';

const COLOR_OPTIONS: { value: RouletteColor | ''; label: string }[] = [
  { value: '', label: 'Авто (случайно)' },
  { value: 'RED', label: 'Красный' },
  { value: 'GREEN', label: 'Зелёный' },
  { value: 'BLACK', label: 'Чёрный' },
];

const ICON_CONFIGS: { color: RouletteColor; key: string; label: string; dot: string }[] = [
  { color: 'GREEN', key: 'roulette.icon_url.green', label: 'Зелёный', dot: 'bg-green-400' },
  { color: 'RED',   key: 'roulette.icon_url.red',   label: 'Красный',  dot: 'bg-red-500'   },
  { color: 'BLACK', key: 'roulette.icon_url.black',  label: 'Чёрный',   dot: 'bg-ink-700'   },
];

function IconUploadItem({
  config,
  initialUrl,
  onSaved,
}: {
  config: typeof ICON_CONFIGS[number];
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
      {/* цветной индикатор */}
      <span className={`h-4 w-4 shrink-0 rounded-full ${config.dot}`} />
      <span className="w-16 shrink-0 text-sm font-medium text-ink-700">{config.label}</span>

      {/* превью */}
      <div className="h-10 w-10 shrink-0 rounded-lg border border-border bg-ink-50 overflow-hidden flex items-center justify-center">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={config.label} className="h-full w-full object-contain" />
        ) : (
          <span className="text-xs text-ink-400">—</span>
        )}
      </div>

      {/* кнопки */}
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

export function RouletteControls({
  currentForcedColor,
  currentHouseEdgePct,
  currentIconGreen,
  currentIconRed,
  currentIconBlack,
}: {
  currentForcedColor: string;
  currentHouseEdgePct: number;
  currentIconGreen: string;
  currentIconRed: string;
  currentIconBlack: string;
}) {
  const [forcedColor, setForcedColor] = useState(currentForcedColor);
  const [houseEdge, setHouseEdge] = useState(currentHouseEdgePct);
  const [saved, setSaved] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const showSaved = (msg: string): void => {
    setSaved(msg);
    setTimeout(() => setSaved(null), 3000);
  };

  const saveForced = (): void => {
    startTransition(async () => {
      await adminApi.settings.set('roulette.forced_color', forcedColor);
      showSaved('Принудительный цвет сохранён');
    });
  };

  const saveEdge = (): void => {
    startTransition(async () => {
      await adminApi.settings.set('roulette.house_edge_pct', houseEdge);
      showSaved(`Целевой GGR ${houseEdge}% сохранён`);
    });
  };

  const iconInitials: Record<RouletteColor, string> = {
    GREEN: currentIconGreen,
    RED:   currentIconRed,
    BLACK: currentIconBlack,
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
            Внимание: следующий раунд будет принудительно {forcedColor}
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

      {/* Sector icons */}
      <div className="md:col-span-2 rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h3 className="text-sm font-semibold text-ink-700 mb-1">Иконки секторов колеса</h3>
        <p className="text-xs text-ink-500 mb-4">
          Загрузите PNG/WEBP-иконку для каждого цвета. Она будет наложена поверх сектора.
          Зелёный: без иконки — показывается корона. Красный/чёрный: без иконки — ничего не отображается.
        </p>
        <div>
          {ICON_CONFIGS.map((cfg) => (
            <IconUploadItem
              key={cfg.color}
              config={cfg}
              initialUrl={iconInitials[cfg.color]}
              onSaved={showSaved}
            />
          ))}
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
