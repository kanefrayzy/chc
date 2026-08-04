'use client';

import { useState } from 'react';
import { codeShopApi, type CodeProductDto, type PurchasedCodeDto } from '@/lib/api/code-shop';
import { ApiException } from '@/lib/api/client';
import { CloseIcon, TicketIcon } from '@/components/icons';

function formatAzn(minor: string): string {
  const value = BigInt(minor);
  const major = value / 100n;
  const frac = (value % 100n).toString().padStart(2, '0');
  return `${major.toLocaleString('ru-RU')},${frac}`;
}

/** Понятные тексты вместо кодов ошибок API. */
const ERRORS: Record<string, string> = {
  INSUFFICIENT_FUNDS: 'Недостаточно средств на балансе — пополните счёт',
  OUT_OF_STOCK: 'Коды этого номинала закончились. Загляните позже',
  CODE_TAKEN: 'Код только что купил другой игрок. Попробуйте ещё раз',
  PRODUCT_DISABLED: 'Этот номинал сейчас недоступен',
  PRODUCT_NOT_FOUND: 'Номинал больше не продаётся',
};

export interface CodeShopProps {
  initialProducts: CodeProductDto[];
  initialHistory: PurchasedCodeDto[];
  isAuthed: boolean;
  locale: string;
}

export function CodeShop({
  initialProducts,
  initialHistory,
  isAuthed,
  locale,
}: CodeShopProps): JSX.Element {
  const [products, setProducts] = useState(initialProducts);
  const [history, setHistory] = useState(initialHistory);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justBought, setJustBought] = useState<PurchasedCodeDto | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const localePrefix = locale === 'ru' ? '' : `/${locale}`;

  async function refresh(): Promise<void> {
    const [p, h] = await Promise.all([
      codeShopApi.products().catch(() => ({ items: products })),
      codeShopApi.history({ limit: 20 }).catch(() => ({ items: history, nextCursor: null })),
    ]);
    setProducts(p.items);
    setHistory(h.items);
  }

  async function buy(product: CodeProductDto): Promise<void> {
    setError(null);
    setBuyingId(product.id);
    try {
      const res = await codeShopApi.buy(product.id);
      setJustBought(res.code);
      await refresh();
    } catch (e) {
      const raw = e instanceof ApiException ? e.message : '';
      setError(ERRORS[raw] ?? raw ?? 'Не удалось купить код');
    } finally {
      setBuyingId(null);
    }
  }

  async function copy(text: string, id: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      /* код всегда можно выделить вручную */
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Купленный только что код — крупно, чтобы не потерялся */}
      {justBought && (
        <div className="overflow-hidden rounded-2xl border border-brand/40 bg-gradient-to-br from-brand/15 via-bg-card to-bg-card">
          <div className="flex items-center justify-between gap-2 border-b border-brand/20 px-4 py-2.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-brand">
              Код куплен
            </span>
            <button
              type="button"
              onClick={() => setJustBought(null)}
              aria-label="Скрыть"
              className="text-text-muted transition-colors hover:text-text-primary"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="p-4">
            <p className="text-sm text-text-secondary">
              {justBought.productName} · номинал{' '}
              <span className="font-semibold text-text-primary">
                {formatAzn(justBought.denominationMinor)} AZN
              </span>
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <code className="min-w-0 flex-1 select-all break-all rounded-lg border border-brand/30 bg-bg-base px-4 py-3 font-mono text-lg font-bold tracking-wider text-brand">
                {justBought.code}
              </code>
              <button
                type="button"
                onClick={() => void copy(justBought.code, justBought.id)}
                className="shrink-0 rounded-lg bg-brand px-5 py-3 text-sm font-bold text-bg-base transition-opacity hover:opacity-90"
              >
                {copiedId === justBought.id ? 'Скопировано' : 'Копировать'}
              </button>
            </div>
            <p className="mt-3 text-xs text-text-muted">
              Код сохранён в истории ниже — вы всегда сможете вернуться и посмотреть его снова.
            </p>
          </div>
        </div>
      )}

      {/* Витрина номиналов */}
      <section>
        <h2 className="text-base font-bold text-text-primary sm:text-lg">Доступные номиналы</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Оплата списывается с баланса, код выдаётся сразу — без ожидания оператора.
        </p>

        {products.length === 0 ? (
          <div className="mt-4 rounded-xl border border-border bg-bg-card px-4 py-12 text-center">
            <p className="mt-2 text-sm text-text-muted">
              Сейчас нет кодов в продаже. Загляните позже или напишите в поддержку.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => {
              const out = p.stock <= 0;
              const busy = buyingId === p.id;
              const discount = BigInt(p.priceMinor) < BigInt(p.denominationMinor);
              return (
                <div
                  key={p.id}
                  className={[
                    'flex flex-col overflow-hidden rounded-2xl border bg-gradient-to-br from-bg-card to-bg-elevated p-4 transition-all',
                    out
                      ? 'border-border opacity-60'
                      : 'border-border hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-glow',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      aria-hidden
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/25"
                    >
                      <TicketIcon className="h-5 w-5" />
                    </span>
                    {out ? (
                      <span className="rounded-full bg-bg-elevated px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-text-muted ring-1 ring-border">
                        Нет в наличии
                      </span>
                    ) : (
                      <span className="rounded-full bg-brand/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand">
                        {p.stock} шт
                      </span>
                    )}
                  </div>

                  <h3 className="mt-3 text-lg font-bold text-text-primary">{p.name}</h3>
                  <p className="mt-0.5 text-sm text-text-secondary">
                    Номинал {formatAzn(p.denominationMinor)} AZN
                  </p>
                  {p.description && (
                    <p className="mt-1 text-xs text-text-muted">{p.description}</p>
                  )}

                  <div className="mt-auto pt-4">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-2xl font-black tabular-nums text-text-primary">
                        {formatAzn(p.priceMinor)}
                      </span>
                      <span className="text-sm font-bold text-text-muted">AZN</span>
                      {discount && (
                        <span className="font-mono text-sm text-text-muted line-through">
                          {formatAzn(p.denominationMinor)}
                        </span>
                      )}
                    </div>

                    {isAuthed ? (
                      <button
                        type="button"
                        disabled={out || busy}
                        onClick={() => void buy(p)}
                        className="mt-3 w-full rounded-xl bg-brand py-3 text-sm font-bold text-bg-base transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-bg-elevated disabled:text-text-muted"
                      >
                        {busy ? 'Покупаем…' : out ? 'Нет в наличии' : 'Купить'}
                      </button>
                    ) : (
                      <a
                        href={`${localePrefix}/login`}
                        className="mt-3 block w-full rounded-xl border border-brand/40 py-3 text-center text-sm font-bold text-brand transition-colors hover:bg-brand/10"
                      >
                        Войти, чтобы купить
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* История покупок */}
      {isAuthed && (
        <section>
          <h2 className="text-base font-bold text-text-primary sm:text-lg">Мои коды</h2>
          {history.length === 0 ? (
            <p className="mt-3 rounded-xl border border-border bg-bg-card px-4 py-8 text-center text-sm text-text-muted">
              Вы ещё не покупали коды
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-bg-card">
              {history.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-text-primary">
                      {h.productName}
                      <span className="ml-2 font-normal text-text-muted">
                        {formatAzn(h.denominationMinor)} AZN
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-text-muted" suppressHydrationWarning>
                      {h.soldAt
                        ? new Date(h.soldAt).toLocaleString(locale === 'az' ? 'az-AZ' : 'ru-RU', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </p>
                  </div>
                  <code className="select-all break-all rounded-lg border border-border bg-bg-base px-3 py-1.5 font-mono text-sm text-text-primary">
                    {h.code}
                  </code>
                  <button
                    type="button"
                    onClick={() => void copy(h.code, h.id)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:border-brand/40 hover:text-brand"
                  >
                    {copiedId === h.id ? 'Готово' : 'Копировать'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
