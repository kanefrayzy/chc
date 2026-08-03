'use client';

import { useState } from 'react';
import {
  adminApi,
  type AdminCodeProduct,
  type AdminCodeSale,
  type AdminCodeItem,
} from '../../../lib/api/admin';
import { ApiException } from '../../../lib/api/client';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { DataTable } from '../../../components/ui/DataTable';
import { minorToAzn, formatDateTime } from '../../../lib/format';

/** Строку «5», «5.5», «5,50» превращаем в qəpik. Пустая строка — ошибка. */
function aznToMinor(input: string): string | null {
  const normalized = input.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, frac = ''] = normalized.split('.');
  return `${BigInt(whole ?? '0') * 100n + BigInt(frac.padEnd(2, '0'))}`;
}

interface FormState {
  id: string | null;
  name: string;
  denomination: string;
  price: string;
  description: string;
  enabled: boolean;
}

const EMPTY_FORM: FormState = {
  id: null,
  name: '',
  denomination: '',
  price: '',
  description: '',
  enabled: true,
};

export function CodeShopManager({
  initialProducts,
  initialSales,
}: {
  initialProducts: AdminCodeProduct[];
  initialSales: AdminCodeSale[];
}) {
  const [products, setProducts] = useState(initialProducts);
  const [sales, setSales] = useState(initialSales);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Заливка кодов
  const [codesFor, setCodesFor] = useState<AdminCodeProduct | null>(null);
  const [codesText, setCodesText] = useState('');
  const [uploading, setUploading] = useState(false);

  // Просмотр склада
  const [stockFor, setStockFor] = useState<AdminCodeProduct | null>(null);
  const [stockItems, setStockItems] = useState<AdminCodeItem[]>([]);

  async function refresh() {
    const [p, s] = await Promise.all([
      adminApi.codeShop.products(),
      adminApi.codeShop.sales({ limit: 30 }).catch(() => ({ items: sales, nextCursor: null })),
    ]);
    setProducts(p.items);
    setSales(s.items);
  }

  async function save() {
    setError(null);
    setNotice(null);

    const denominationMinor = aznToMinor(form.denomination);
    const priceMinor = aznToMinor(form.price);
    if (!form.name.trim()) return setError('Укажите название номинала');
    if (!denominationMinor) return setError('Номинал — число, например 5 или 5.50');
    if (!priceMinor) return setError('Цена — число, например 5 или 4.75');

    setSaving(true);
    try {
      if (form.id) {
        await adminApi.codeShop.updateProduct(form.id, {
          name: form.name.trim(),
          denominationMinor,
          priceMinor,
          description: form.description.trim() || null,
          enabled: form.enabled,
        });
      } else {
        await adminApi.codeShop.createProduct({
          name: form.name.trim(),
          denominationMinor,
          priceMinor,
          ...(form.description.trim() ? { description: form.description.trim() } : {}),
          enabled: form.enabled,
        });
      }
      setForm(EMPTY_FORM);
      await refresh();
      setNotice('Сохранено');
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: AdminCodeProduct) {
    setError(null);
    try {
      await adminApi.codeShop.deleteProduct(p.id);
      await refresh();
    } catch (e) {
      const msg = e instanceof ApiException ? e.message : '';
      setError(
        msg === 'PRODUCT_HAS_SALES'
          ? 'Номинал уже продавался — его нельзя удалить. Отключите его вместо удаления'
          : msg || 'Не удалось удалить',
      );
    }
  }

  async function toggleEnabled(p: AdminCodeProduct) {
    await adminApi.codeShop.updateProduct(p.id, { enabled: !p.enabled });
    await refresh();
  }

  async function uploadCodes() {
    if (!codesFor) return;
    setError(null);
    setUploading(true);
    try {
      const res = await adminApi.codeShop.addCodes(codesFor.id, codesText);
      setNotice(
        `Добавлено кодов: ${res.added}${res.skipped > 0 ? `, пропущено дубликатов: ${res.skipped}` : ''}`,
      );
      setCodesText('');
      setCodesFor(null);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Не удалось добавить коды');
    } finally {
      setUploading(false);
    }
  }

  async function openStock(p: AdminCodeProduct) {
    setStockFor(p);
    setStockItems([]);
    const res = await adminApi.codeShop.listCodes(p.id, 'AVAILABLE').catch(() => ({ items: [] }));
    setStockItems(res.items);
  }

  async function deleteCode(id: string) {
    await adminApi.codeShop.deleteCode(id).catch(() => undefined);
    if (stockFor) await openStock(stockFor);
    await refresh();
  }

  const codesCount = codesText
    .split(/[\r\n,;\s]+/)
    .map((c) => c.trim())
    .filter(Boolean).length;

  return (
    <div className="space-y-5">
      {error && <div className="rounded-lg bg-danger/10 px-4 py-2.5 text-sm text-danger">{error}</div>}
      {notice && (
        <div className="rounded-lg bg-success/10 px-4 py-2.5 text-sm text-success">{notice}</div>
      )}

      {/* Форма номинала */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-ink-900">
          {form.id ? 'Редактирование номинала' : 'Новый номинал'}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="text-xs text-ink-500">Название</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Код 5 AZN"
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink-900 outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="text-xs text-ink-500">Номинал, AZN</span>
            <input
              value={form.denomination}
              onChange={(e) => setForm({ ...form, denomination: e.target.value })}
              placeholder="5"
              inputMode="decimal"
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink-900 outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="text-xs text-ink-500">Цена продажи, AZN</span>
            <input
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="5"
              inputMode="decimal"
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink-900 outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="text-xs text-ink-500">Описание (необязательно)</span>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Пополнение счёта в казино"
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink-900 outline-none focus:border-primary"
            />
          </label>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />
            Показывать игрокам
          </label>
          <Button size="sm" onClick={() => void save()} disabled={saving}>
            {saving ? 'Сохраняем…' : form.id ? 'Сохранить' : 'Добавить номинал'}
          </Button>
          {form.id && (
            <Button size="sm" variant="ghost" onClick={() => setForm(EMPTY_FORM)}>
              Отмена
            </Button>
          )}
        </div>
      </Card>

      {/* Список номиналов */}
      <Card>
        <DataTable
          rows={products}
          empty="Пока нет ни одного номинала"
          columns={[
            {
              key: 'name',
              header: 'Номинал',
              cell: (p) => (
                <div>
                  <div className="text-sm font-medium text-ink-900">{p.name}</div>
                  {p.description && <div className="text-xs text-ink-400">{p.description}</div>}
                </div>
              ),
            },
            {
              key: 'denomination',
              header: 'Номинал',
              align: 'right',
              cell: (p) => (
                <span className="font-mono tabular-nums text-ink-700">
                  {minorToAzn(p.denominationMinor)}
                </span>
              ),
            },
            {
              key: 'price',
              header: 'Цена',
              align: 'right',
              cell: (p) => (
                <span className="font-mono font-semibold tabular-nums text-ink-900">
                  {minorToAzn(p.priceMinor)}
                </span>
              ),
            },
            {
              key: 'stock',
              header: 'На складе',
              align: 'right',
              cell: (p) => (
                <Badge tone={p.stock > 5 ? 'success' : p.stock > 0 ? 'warning' : 'danger'}>
                  {p.stock} шт
                </Badge>
              ),
            },
            {
              key: 'sold',
              header: 'Продано',
              align: 'right',
              cell: (p) => <span className="text-sm text-ink-500">{p.soldCount}</span>,
            },
            {
              key: 'status',
              header: 'Статус',
              cell: (p) => (
                <Badge tone={p.enabled ? 'success' : 'neutral'}>
                  {p.enabled ? 'В продаже' : 'Скрыт'}
                </Badge>
              ),
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              cell: (p) => (
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <Button size="sm" onClick={() => setCodesFor(p)}>
                    + Коды
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void openStock(p)}>
                    Склад
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setForm({
                        id: p.id,
                        name: p.name,
                        denomination: minorToAzn(p.denominationMinor),
                        price: minorToAzn(p.priceMinor),
                        description: p.description ?? '',
                        enabled: p.enabled,
                      })
                    }
                  >
                    Изменить
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void toggleEnabled(p)}>
                    {p.enabled ? 'Скрыть' : 'Показать'}
                  </Button>
                  {p.soldCount === 0 && (
                    <Button size="sm" variant="secondary" onClick={() => void remove(p)}>
                      Удалить
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Последние продажи */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-ink-900">Последние продажи</h2>
        <DataTable
          rows={sales}
          empty="Продаж пока нет"
          columns={[
            {
              key: 'product',
              header: 'Номинал',
              cell: (s) => <span className="text-sm text-ink-900">{s.productName}</span>,
            },
            {
              key: 'user',
              header: 'Игрок',
              cell: (s) => <span className="text-sm text-ink-700">{s.username ?? '—'}</span>,
            },
            {
              key: 'code',
              header: 'Код',
              cell: (s) => <span className="font-mono text-xs text-ink-500">{s.code}</span>,
            },
            {
              key: 'price',
              header: 'Списано',
              align: 'right',
              cell: (s) => (
                <span className="font-mono tabular-nums">{minorToAzn(s.priceMinor)}</span>
              ),
            },
            {
              key: 'soldAt',
              header: 'Когда',
              cell: (s) => (
                <span className="text-sm text-ink-500">
                  {s.soldAt ? formatDateTime(s.soldAt) : '—'}
                </span>
              ),
            },
          ]}
        />
      </Card>

      {/* Модалка заливки кодов */}
      {codesFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-xl bg-surface p-5 shadow-xl">
            <h3 className="text-base font-semibold text-ink-900">
              Добавить коды — {codesFor.name}
            </h3>
            <p className="mt-1 text-xs text-ink-500">
              По одному коду в строке. Дубликаты внутри номинала пропускаются автоматически.
            </p>
            <textarea
              value={codesText}
              onChange={(e) => setCodesText(e.target.value)}
              rows={10}
              placeholder={'ABCD-1234-EFGH\nIJKL-5678-MNOP'}
              className="mt-3 w-full rounded-lg border border-border bg-page px-3 py-2 font-mono text-sm text-ink-900 outline-none focus:border-primary"
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-ink-500">Распознано кодов: {codesCount}</span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setCodesFor(null);
                    setCodesText('');
                  }}
                >
                  Отмена
                </Button>
                <Button onClick={() => void uploadCodes()} disabled={uploading || codesCount === 0}>
                  {uploading ? 'Добавляем…' : 'Добавить'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модалка склада */}
      {stockFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[80vh] w-full max-w-xl flex-col rounded-xl bg-surface p-5 shadow-xl">
            <h3 className="text-base font-semibold text-ink-900">
              Склад — {stockFor.name} ({stockItems.length} шт)
            </h3>
            <div className="mt-3 flex-1 overflow-y-auto">
              {stockItems.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-400">Свободных кодов нет</p>
              ) : (
                <ul className="divide-y divide-border">
                  {stockItems.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                      <code className="font-mono text-sm text-ink-900">{i.code}</code>
                      <Button size="sm" variant="ghost" onClick={() => void deleteCode(i.id)}>
                        Удалить
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="mt-3 text-right">
              <Button variant="ghost" onClick={() => setStockFor(null)}>
                Закрыть
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
