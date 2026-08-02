'use client';

import { useState } from 'react';
import { adminApi } from '../../../lib/api/admin';

type Mode = 'manual' | 'semi' | 'auto';

const MODES: { id: Mode; title: string; hint: string }[] = [
  {
    id: 'manual',
    title: 'Вручную',
    hint: 'Модератор сам переводит деньги и отмечает заявку выполненной',
  },
  {
    id: 'semi',
    title: 'Полуавтомат',
    hint: 'Модератор жмёт «Одобрить» — деньги отправляет система через Betatransfer',
  },
  {
    id: 'auto',
    title: 'Инстант',
    hint: 'Выплата уходит сразу при создании заявки, без модератора',
  },
];

export interface PayoutModeSwitchProps {
  initialMode: string;
  /** Порог (qəpik), выше которого заявка всегда идёт модератору. */
  thresholdMinor: string;
}

/** Переключатель режима выплат прямо на странице выводов. */
export function PayoutModeSwitch({ initialMode, thresholdMinor }: PayoutModeSwitchProps) {
  const [mode, setMode] = useState<Mode>(
    initialMode === 'auto' || initialMode === 'semi' ? initialMode : 'manual',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const thresholdAzn = (Number(thresholdMinor || '0') / 100).toLocaleString('ru-RU');

  const change = async (next: Mode) => {
    if (next === mode || saving) return;
    const prev = mode;
    setMode(next);
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await adminApi.settings.set('withdrawal.auto_mode', next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setMode(prev);
      setError(e instanceof Error ? e.message : 'Не удалось сохранить режим');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-4 rounded-2xl border border-border bg-surface p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink-900">Режим выплат</h2>
          <p className="mt-0.5 text-xs text-ink-500">
            Применяется к выводам на карты через Betatransfer. Заявки свыше{' '}
            <b>{thresholdAzn} AZN</b> в любом режиме уходят модератору.
          </p>
        </div>
        {saved && <span className="shrink-0 text-xs font-medium text-emerald-600">Сохранено</span>}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {MODES.map((m) => {
          const active = m.id === mode;
          return (
            <button
              key={m.id}
              type="button"
              disabled={saving}
              onClick={() => void change(m.id)}
              className={[
                'rounded-xl border p-3 text-left transition-colors disabled:opacity-60',
                active
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                  : 'border-border bg-surface hover:border-ink-300',
              ].join(' ')}
            >
              <div className="flex items-center gap-2">
                <span
                  className={[
                    'h-3.5 w-3.5 shrink-0 rounded-full border',
                    active ? 'border-primary bg-primary' : 'border-ink-300',
                  ].join(' ')}
                />
                <span className="text-sm font-semibold text-ink-900">{m.title}</span>
              </div>
              <p className="mt-1 text-xs leading-snug text-ink-500">{m.hint}</p>
            </button>
          );
        })}
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
