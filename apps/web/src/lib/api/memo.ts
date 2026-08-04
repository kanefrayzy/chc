/**
 * Кэш ответа на короткое время + склейка параллельных запросов.
 *
 * Страницы рендерятся на сервере при каждом заходе, и одни и те же данные
 * (публичные настройки, словарь переводов) запрашивались по несколько раз за
 * рендер — на главной настройки тянулись семь раз. При полусотне посетителей
 * это давало сотни лишних запросов в минуту и упирало API в лимит частоты.
 *
 * Пока запрос в полёте, все остальные ждут его же результат, а не шлют свой.
 * Ошибка не кэшируется: следующий вызов попробует снова.
 */
export function memoTtl<T>(loader: () => Promise<T>, ttlMs: number): () => Promise<T> {
  let value: T | undefined;
  let expiresAt = 0;
  let inFlight: Promise<T> | null = null;

  return async function cached(): Promise<T> {
    const now = Date.now();
    if (value !== undefined && now < expiresAt) return value;
    if (inFlight) return inFlight;

    inFlight = loader()
      .then((next) => {
        value = next;
        expiresAt = Date.now() + ttlMs;
        return next;
      })
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  };
}

/** То же, но с ключом — например, по локали. */
export function memoTtlBy<K extends string, T>(
  loader: (key: K) => Promise<T>,
  ttlMs: number,
): (key: K) => Promise<T> {
  const byKey = new Map<K, () => Promise<T>>();
  return (key: K) => {
    let entry = byKey.get(key);
    if (!entry) {
      entry = memoTtl(() => loader(key), ttlMs);
      byKey.set(key, entry);
    }
    return entry();
  };
}
