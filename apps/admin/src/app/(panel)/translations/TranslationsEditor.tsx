'use client';

import { useMemo, useState, useTransition } from 'react';
import { adminApi, type TranslationEntry } from '../../../lib/api/admin';

type Locale = 'ru' | 'az';
type Filter = 'all' | 'changed' | 'empty';

interface Props {
  locale: Locale;
  entries: TranslationEntry[];
  isCustom: boolean;
}

/** Первый сегмент ключа — раздел интерфейса. */
function namespaceOf(key: string): string {
  const dot = key.indexOf('.');
  return dot === -1 ? key : key.slice(0, dot);
}

/** Понятные названия разделов; остальные показываем как есть. */
const SECTION_NAMES: Record<string, string> = {
  common: 'Общее',
  sidebar: 'Боковое меню',
  topbar: 'Верхняя панель',
  landing: 'Главная страница',
  nav: 'Навигация',
  hero: 'Первый экран',
  stats: 'Счётчики',
  promo: 'Промо-блок',
  winners: 'Лента выигрышей',
  winnersTable: 'Таблица выигрышей',
  features: 'Преимущества',
  auth: 'Вход и регистрация',
  profile: 'Профиль',
  wallet: 'Кошелёк',
  deposit: 'Пополнение',
  withdraw: 'Вывод',
  chat: 'Поддержка',
  codePurchase: 'Покупка кода (чат)',
  codeShop: 'Магазин кодов',
  roulette: 'Рулетка',
  mines: 'Mines',
  classic: 'Классический',
  lottery: 'Лотерея / Poz Qazan',
  jackpot: 'Прогрессивный джекпот',
  referrals: 'Рефералы',
  referralsDash: 'Партнёрская панель',
  ranks: 'Ранги',
  faq: 'FAQ',
  bonuses: 'Бонусы',
  telegram: 'Телеграм-баннер',
};

/** Плейсхолдеры ICU: {price}, {count} — их нельзя терять при переводе. */
function placeholdersOf(value: string): string[] {
  return [...value.matchAll(/\{(\w+)[^}]*\}/g)].map((m) => m[1] as string);
}

function missingPlaceholders(defaultValue: string, value: string): string[] {
  const have = new Set(placeholdersOf(value));
  return [...new Set(placeholdersOf(defaultValue))].filter((p) => !have.has(p));
}

export function TranslationsEditor({ locale, entries, isCustom: initialIsCustom }: Props) {
  const [rows, setRows] = useState<TranslationEntry[]>(entries);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [isCustom, setIsCustom] = useState(initialIsCustom);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  /** Текущее значение с учётом несохранённой правки. */
  const valueOf = (row: TranslationEntry): string => draft[row.key] ?? row.value;

  const dirtyKeys = useMemo(
    () => Object.keys(draft).filter((k) => {
      const row = rows.find((r) => r.key === k);
      return row !== undefined && draft[k] !== row.value;
    }),
    [draft, rows],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === 'changed' && !row.overridden && !dirtyKeys.includes(row.key)) return false;
      if (filter === 'empty' && valueOf(row).trim() !== '') return false;
      if (q === '') return true;
      return (
        row.key.toLowerCase().includes(q) ||
        row.value.toLowerCase().includes(q) ||
        row.defaultValue.toLowerCase().includes(q)
      );
    });
    // valueOf зависит от draft — он в списке зависимостей
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, filter, draft, dirtyKeys]);

  const sections = useMemo(() => {
    const map = new Map<string, TranslationEntry[]>();
    for (const row of visible) {
      const ns = namespaceOf(row.key);
      const list = map.get(ns);
      if (list) list.push(row);
      else map.set(ns, [row]);
    }
    return [...map.entries()];
  }, [visible]);

  const searching = query.trim() !== '' || filter !== 'all';

  function toggleSection(ns: string): void {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(ns)) next.delete(ns);
      else next.add(ns);
      return next;
    });
  }

  function edit(key: string, value: string): void {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setError(null);
    setSaved(null);
  }

  /** Сбрасывает одну строку к встроенному значению. */
  function resetKey(row: TranslationEntry): void {
    setDraft((prev) => ({ ...prev, [row.key]: row.defaultValue }));
    setError(null);
    setSaved(null);
  }

  function handleSave(): void {
    if (dirtyKeys.length === 0) return;
    setError(null);
    setSaved(null);

    const payload: Record<string, string | null> = {};
    for (const key of dirtyKeys) {
      const row = rows.find((r) => r.key === key);
      if (!row) continue;
      const value = draft[key] as string;
      // Вернули дефолт — значит правку надо удалить, а не хранить копию
      payload[key] = value === row.defaultValue ? null : value;
    }

    startTransition(async () => {
      try {
        const res = await adminApi.translations.patch(locale, payload);
        setRows((prev) =>
          prev.map((row) => {
            if (!(row.key in payload)) return row;
            const next = payload[row.key];
            return next === null
              ? { ...row, value: row.defaultValue, overridden: false }
              : { ...row, value: next as string, overridden: true };
          }),
        );
        setDraft({});
        setIsCustom(res.isCustom);
        setSaved(res.changed);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  function handleResetAll(): void {
    if (!confirm('Сбросить все правки этого языка и вернуться к встроенным текстам?')) return;
    startTransition(async () => {
      try {
        await adminApi.translations.reset(locale);
        const res = await adminApi.translations.get(locale);
        setRows(res.entries);
        setDraft({});
        setIsCustom(res.isCustom);
        setSaved(0);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  const overriddenCount = rows.filter((r) => r.overridden).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Статус и фильтры */}
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={[
            'rounded-full px-2.5 py-0.5 text-xs font-semibold',
            isCustom ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700',
          ].join(' ')}
        >
          {isCustom ? `Изменено ключей: ${overriddenCount}` : 'Все тексты встроенные'}
        </span>
        <span className="text-xs text-ink-500">Всего ключей: {rows.length}</span>
        {isCustom && (
          <button
            onClick={handleResetAll}
            disabled={isPending}
            className="text-xs text-red-600 underline hover:no-underline disabled:opacity-50"
          >
            Сбросить всё к дефолту
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по ключу или тексту"
          className="min-w-[240px] flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-ink-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
        {([
          ['all', 'Все'],
          ['changed', 'Изменённые'],
          ['empty', 'Пустые'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={[
              'rounded-xl border px-4 py-2.5 text-sm font-semibold transition',
              filter === id
                ? 'border-brand bg-brand/10 text-brand'
                : 'border-border bg-surface text-ink-500 hover:bg-ink-50',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Разделы */}
      <div className="flex flex-col gap-2">
        {sections.length === 0 && (
          <p className="rounded-xl border border-border bg-ink-50 px-4 py-6 text-center text-sm text-ink-500">
            Ничего не найдено
          </p>
        )}

        {sections.map(([ns, list]) => {
          const isOpen = searching || openSections.has(ns);
          const changedHere = list.filter(
            (r) => r.overridden || dirtyKeys.includes(r.key),
          ).length;
          return (
            <section key={ns} className="overflow-hidden rounded-xl border border-border">
              <button
                onClick={() => toggleSection(ns)}
                className="flex w-full items-center justify-between gap-3 bg-ink-50 px-4 py-3 text-left hover:bg-ink-100"
              >
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink-900">
                    {SECTION_NAMES[ns] ?? ns}
                  </span>
                  <code className="text-[11px] text-ink-400">{ns}</code>
                </span>
                <span className="flex items-center gap-2 text-xs text-ink-500">
                  {changedHere > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">
                      {changedHere}
                    </span>
                  )}
                  <span>{list.length}</span>
                  <span className="text-base leading-none">{isOpen ? '−' : '+'}</span>
                </span>
              </button>

              {isOpen && (
                <div className="divide-y divide-border">
                  {list.map((row) => {
                    const value = valueOf(row);
                    const dirty = dirtyKeys.includes(row.key);
                    const lost = missingPlaceholders(row.defaultValue, value);
                    const multiline = row.defaultValue.length > 90;
                    return (
                      <div
                        key={row.key}
                        className={[
                          'grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,280px)_1fr]',
                          dirty ? 'bg-amber-50/60' : 'bg-surface',
                        ].join(' ')}
                      >
                        <div className="min-w-0">
                          <code className="block truncate text-xs font-semibold text-ink-700">
                            {row.key}
                          </code>
                          {(row.overridden || dirty) && (
                            <p className="mt-1 truncate text-[11px] text-ink-400">
                              было: {row.defaultValue || '—'}
                            </p>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-start gap-2">
                            {multiline ? (
                              <textarea
                                value={value}
                                onChange={(e) => edit(row.key, e.target.value)}
                                rows={2}
                                className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                              />
                            ) : (
                              <input
                                value={value}
                                onChange={(e) => edit(row.key, e.target.value)}
                                className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                              />
                            )}
                            {(row.overridden || dirty) && value !== row.defaultValue && (
                              <button
                                onClick={() => resetKey(row)}
                                title="Вернуть встроенный текст"
                                className="shrink-0 rounded-lg border border-border px-2.5 py-2 text-xs text-ink-500 hover:bg-ink-50"
                              >
                                Сброс
                              </button>
                            )}
                          </div>
                          {lost.length > 0 && (
                            <p className="mt-1 text-[11px] text-red-600">
                              Потеряны подстановки: {lost.map((p) => `{${p}}`).join(', ')} — без
                              них на месте значения будет пусто
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
      {saved !== null && !error && (
        <p className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">
          Сохранено. Тексты на сайте обновятся в течение минуты.
        </p>
      )}

      {/* Панель сохранения */}
      <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-card">
        <span className="text-sm text-ink-500">
          {dirtyKeys.length > 0
            ? `Не сохранено: ${dirtyKeys.length}`
            : 'Изменений нет'}
        </span>
        <div className="flex gap-2">
          {dirtyKeys.length > 0 && (
            <button
              onClick={() => setDraft({})}
              disabled={isPending}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-ink-500 hover:bg-ink-50 disabled:opacity-50"
            >
              Отменить
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isPending || dirtyKeys.length === 0}
            className="rounded-xl bg-brand px-6 py-2.5 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-50"
          >
            {isPending ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
