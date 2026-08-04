'use client';

import { useState, useTransition } from 'react';
import { adminApi } from '../../../lib/api/admin';

type Locale = 'ru' | 'az';

interface Props {
  locale: Locale;
  initial: string;
  isCustom: boolean;
}

export function TranslationsEditor({ locale, initial, isCustom: initialIsCustom }: Props) {
  const [json, setJson] = useState(initial);
  const [isCustom, setIsCustom] = useState(initialIsCustom);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function validate(value: string): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setError('Ожидается JSON-объект верхнего уровня');
        return null;
      }
      return parsed as Record<string, unknown>;
    } catch {
      setError('Невалидный JSON');
      return null;
    }
  }

  function handleSave() {
    setError(null);
    setSuccess(false);
    const parsed = validate(json);
    if (!parsed) return;
    startTransition(async () => {
      try {
        await adminApi.translations.save(locale, parsed);
        setIsCustom(true);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } catch (e) {
        setError(String(e));
      }
    });
  }

  function handleReset() {
    if (!confirm('Сбросить переопределение и вернуться к встроенным переводам?')) return;
    startTransition(async () => {
      try {
        await adminApi.translations.reset(locale);
        const res = await adminApi.translations.get(locale);
        setJson(JSON.stringify(res.messages, null, 2));
        setIsCustom(false);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } catch (e) {
        setError(String(e));
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span
          className={[
            'rounded-full px-2.5 py-0.5 text-xs font-semibold',
            isCustom
              ? 'bg-amber-100 text-amber-700'
              : 'bg-green-100 text-green-700',
          ].join(' ')}
        >
          {isCustom ? 'Пользовательские переводы' : 'Встроенные (дефолтные)'}
        </span>
        {isCustom && (
          <button
            onClick={handleReset}
            disabled={isPending}
            className="text-xs text-red-600 underline hover:no-underline disabled:opacity-50"
          >
            Сбросить к дефолту
          </button>
        )}
      </div>

      <textarea
        value={json}
        onChange={(e) => { setJson(e.target.value); setError(null); }}
        rows={32}
        spellCheck={false}
        className="w-full rounded-xl border border-border bg-ink-50 px-4 py-3 font-mono text-xs leading-relaxed text-ink-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        placeholder="{}"
      />

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}
      {success && (
        <p className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">Сохранено</p>
      )}

      <button
        onClick={handleSave}
        disabled={isPending}
        className="self-end rounded-xl bg-brand px-6 py-2.5 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-50"
      >
        {isPending ? 'Сохраняем…' : 'Сохранить'}
      </button>
    </div>
  );
}
