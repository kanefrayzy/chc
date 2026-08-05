'use client';

import { useRef, useState } from 'react';
import {
  adminApi,
  type AdminPaymentMethodRow,
  type PaymentMethodInput,
  type PaymentMethodKind,
  type PaymentProviderKind,
} from '../../../lib/api/admin';
import { Alert } from '../../../components/ui/Alert';
import { Card } from '../../../components/ui/Card';

// ── helpers ─────────────────────────────────────────────────────────────

function minorToDisplay(minor: string): string {
  const n = BigInt(minor);
  if (n === 0n) return '0';
  const whole = n / 100n;
  const frac = n % 100n;
  if (frac === 0n) return whole.toString();
  return `${whole}.${String(frac).padStart(2, '0')}`;
}

function displayToMinor(display: string): string {
  const cleaned = display.replace(/\s/g, '').replace(',', '.');
  if (cleaned === '') return '0';
  const num = parseFloat(cleaned);
  if (Number.isNaN(num) || num < 0) throw new Error('Invalid number');
  return String(Math.round(num * 100));
}

// ── form types ──────────────────────────────────────────────────────────

interface MethodFormData {
  name: string;
  provider: PaymentProviderKind;
  kind: PaymentMethodKind;
  currency: string;
  description: string;
  minDisplay: string;
  maxDisplay: string;
  displayOrder: string;
  enabled: boolean;
  configJson: string;
}

function emptyForm(): MethodFormData {
  return {
    name: '',
    provider: 'BETATRANSFER',
    kind: 'BOTH',
    currency: 'AZN',
    description: '',
    minDisplay: '',
    maxDisplay: '',
    displayOrder: '0',
    enabled: true,
    configJson: '{}',
  };
}

function rowToForm(r: AdminPaymentMethodRow): MethodFormData {
  return {
    name: r.name,
    provider: r.provider,
    kind: r.kind,
    currency: r.currency,
    description: r.description ?? '',
    minDisplay: minorToDisplay(r.minAmountMinor),
    maxDisplay: minorToDisplay(r.maxAmountMinor),
    displayOrder: String(r.displayOrder),
    enabled: r.enabled,
    configJson: JSON.stringify(r.config ?? {}, null, 2),
  };
}

function formToInput(f: MethodFormData): PaymentMethodInput {
  let config: Record<string, unknown> = {};
  if (f.configJson.trim()) {
    config = JSON.parse(f.configJson) as Record<string, unknown>;
  }
  return {
    name: f.name.trim(),
    provider: f.provider,
    kind: f.kind,
    currency: f.currency.trim().toUpperCase(),
    description: f.description.trim() || null,
    minAmountMinor: displayToMinor(f.minDisplay),
    maxAmountMinor: displayToMinor(f.maxDisplay),
    displayOrder: Number(f.displayOrder) || 0,
    enabled: f.enabled,
    config,
  };
}

// ── modal ───────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700 text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── method form ─────────────────────────────────────────────────────────

interface FormProps {
  data: MethodFormData;
  onChange: (d: MethodFormData) => void;
  error?: string | null;
  loading?: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
}

function MethodForm({ data, onChange, error, loading, onSubmit, onCancel, submitLabel }: FormProps) {
  return (
    <div className="space-y-3">
      {error && <Alert tone="danger">{error}</Alert>}

      <div>
        <label className="block text-xs font-medium text-ink-600 mb-1">Название</label>
        <input
          type="text"
          className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-surface text-ink-900"
          placeholder="Карта VISA / USDT TRC20"
          value={data.name}
          onChange={(e) => onChange({ ...data, name: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-ink-600 mb-1">Агрегатор</label>
          <select
            className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-surface text-ink-900"
            value={data.provider}
            onChange={(e) => onChange({ ...data, provider: e.target.value as PaymentProviderKind })}
          >
            <option value="BETATRANSFER">Betatransfer</option>
            <option value="WESTWALLET">Westwallet</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-600 mb-1">Тип</label>
          <select
            className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-surface text-ink-900"
            value={data.kind}
            onChange={(e) => onChange({ ...data, kind: e.target.value as PaymentMethodKind })}
          >
            <option value="DEPOSIT">Только пополнения</option>
            <option value="WITHDRAWAL">Только выводы</option>
            <option value="BOTH">Пополнения и выводы</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-ink-600 mb-1">Валюта</label>
          <input
            type="text"
            className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-surface text-ink-900"
            placeholder="AZN"
            value={data.currency}
            onChange={(e) => onChange({ ...data, currency: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-600 mb-1">Мин (AZN)</label>
          <input
            type="text"
            className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-surface text-ink-900"
            placeholder="0"
            value={data.minDisplay}
            onChange={(e) => onChange({ ...data, minDisplay: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-600 mb-1">Макс (AZN, 0 = ∞)</label>
          <input
            type="text"
            className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-surface text-ink-900"
            placeholder="0"
            value={data.maxDisplay}
            onChange={(e) => onChange({ ...data, maxDisplay: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-600 mb-1">Описание</label>
        <input
          type="text"
          className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-surface text-ink-900"
          placeholder="VISA/Mastercard, локальные карты"
          value={data.description}
          onChange={(e) => onChange({ ...data, description: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-ink-600 mb-1">Порядок</label>
          <input
            type="number"
            className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-surface text-ink-900"
            value={data.displayOrder}
            onChange={(e) => onChange({ ...data, displayOrder: e.target.value })}
          />
        </div>
        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-sm text-ink-700 select-none">
            <input
              type="checkbox"
              checked={data.enabled}
              onChange={(e) => onChange({ ...data, enabled: e.target.checked })}
            />
            Включён
          </label>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-600 mb-1">
          Конфиг провайдера (JSON)
        </label>
        <textarea
          rows={5}
          className="w-full font-mono border border-border rounded-md px-3 py-1.5 text-xs bg-surface text-ink-900"
          placeholder='{"paymentSystem":"P2R_AZN"}'
          value={data.configJson}
          onChange={(e) => onChange({ ...data, configJson: e.target.value })}
        />
        <p className="text-xs text-ink-500 mt-1">
          BETATRANSFER: <code>paymentSystem</code>. WESTWALLET: <code>ticker</code>, <code>dest_tag_required</code>.
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="px-4 py-1.5 text-sm rounded-md border border-border text-ink-600 hover:bg-ink-50"
        >
          Отмена
        </button>
        <button
          onClick={onSubmit}
          disabled={loading}
          className="px-4 py-1.5 text-sm rounded-md bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? 'Сохранение…' : submitLabel}
        </button>
      </div>
    </div>
  );
}

// ── panel ───────────────────────────────────────────────────────────────

/**
 * Минимум, ниже которого Betatransfer отклоняет платёж на своей стороне
 * (проверено запросом к их API: «Min amount is 50 AZN»). Держим как подсказку,
 * а не как жёсткую валидацию: договорённость с провайдером может измениться.
 */
const BETATRANSFER_MIN_MINOR = 5000;

function belowProviderFloor(m: {
  provider: string;
  kind: string;
  minAmountMinor: string;
}): boolean {
  if (m.provider !== 'BETATRANSFER') return false;
  if (m.kind !== 'DEPOSIT' && m.kind !== 'BOTH') return false;
  const min = Number(m.minAmountMinor);
  return min > 0 && min < BETATRANSFER_MIN_MINOR;
}

export function PaymentMethodsPanel({ initialItems }: { initialItems: AdminPaymentMethodRow[] }) {
  const [items, setItems] = useState<AdminPaymentMethodRow[]>(initialItems);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // create
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<MethodFormData>(emptyForm());
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  async function handleCreate() {
    setCreateError(null);
    let payload: PaymentMethodInput;
    try {
      payload = formToInput(createForm);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Неверные данные формы');
      return;
    }
    setCreateLoading(true);
    try {
      const created = await adminApi.paymentMethods.create(payload);
      setItems((prev) => [...prev, created].sort((a, b) => a.displayOrder - b.displayOrder));
      setShowCreate(false);
      setCreateForm(emptyForm());
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Ошибка создания');
    } finally {
      setCreateLoading(false);
    }
  }

  // edit
  const [editRow, setEditRow] = useState<AdminPaymentMethodRow | null>(null);
  const [editForm, setEditForm] = useState<MethodFormData>(emptyForm());
  const [editError, setEditError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  function openEdit(r: AdminPaymentMethodRow) {
    setEditRow(r);
    setEditForm(rowToForm(r));
    setEditError(null);
  }

  async function handleEdit() {
    if (!editRow) return;
    setEditError(null);
    let payload: PaymentMethodInput;
    try {
      payload = formToInput(editForm);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Неверные данные формы');
      return;
    }
    setEditLoading(true);
    try {
      const updated = await adminApi.paymentMethods.update(editRow.id, payload);
      setItems((prev) =>
        prev.map((m) => (m.id === updated.id ? updated : m)).sort((a, b) => a.displayOrder - b.displayOrder),
      );
      setEditRow(null);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setEditLoading(false);
    }
  }

  // delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleteLoading(true);
    setGlobalError(null);
    try {
      await adminApi.paymentMethods.remove(deleteId);
      setItems((prev) => prev.filter((m) => m.id !== deleteId));
      setDeleteId(null);
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : 'Ошибка удаления');
    } finally {
      setDeleteLoading(false);
    }
  }

  // icon
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingIconId, setPendingIconId] = useState<string | null>(null);

  function openIconUpload(id: string) {
    setPendingIconId(id);
    fileRef.current?.click();
  }

  async function handleIconChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !pendingIconId) return;
    setGlobalError(null);
    try {
      const updated = await adminApi.paymentMethods.uploadIcon(pendingIconId, file);
      setItems((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Ошибка загрузки иконки');
    } finally {
      setPendingIconId(null);
    }
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={handleIconChange}
      />

      {globalError && <Alert tone="danger" className="mb-4">{globalError}</Alert>}

      <div className="mb-4 flex justify-end">
        <button
          onClick={() => {
            setShowCreate(true);
            setCreateForm(emptyForm());
            setCreateError(null);
          }}
          className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90"
        >
          + Добавить метод
        </button>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-ink-500 uppercase tracking-wider">
              <th className="px-4 py-3 w-12">#</th>
              <th className="px-4 py-3">Иконка</th>
              <th className="px-4 py-3">Название</th>
              <th className="px-4 py-3">Агрегатор</th>
              <th className="px-4 py-3">Тип</th>
              <th className="px-4 py-3">Валюта</th>
              <th className="px-4 py-3">Лимиты</th>
              <th className="px-4 py-3">Вкл.</th>
              <th className="px-4 py-3 text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((m) => (
              <tr key={m.id} className="hover:bg-ink-50/50">
                <td className="px-4 py-3 text-ink-500">{m.displayOrder}</td>
                <td className="px-4 py-3">
                  {m.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.iconUrl} alt={m.name} className="h-8 w-8 object-contain rounded" />
                  ) : (
                    <span className="text-ink-400 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-ink-900 font-medium">{m.name}</td>
                <td className="px-4 py-3 text-xs text-ink-600">
                  {m.provider === 'BETATRANSFER' ? 'Betatransfer' : 'Westwallet'}
                </td>
                <td className="px-4 py-3 text-xs text-ink-600">{m.kind}</td>
                <td className="px-4 py-3 text-xs text-ink-700 font-mono">{m.currency}</td>
                <td className="px-4 py-3 text-xs text-ink-600">
                  {minorToDisplay(m.minAmountMinor)} – {m.maxAmountMinor === '0' ? '∞' : minorToDisplay(m.maxAmountMinor)}
                  {belowProviderFloor(m) && (
                    <div
                      className="mt-0.5 text-[11px] text-danger"
                      title="Betatransfer отклонит такой платёж на своей стороне"
                    >
                      провайдер примет только от {minorToDisplay(String(BETATRANSFER_MIN_MINOR))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-xs">
                  <span
                    className={
                      m.enabled
                        ? 'inline-block px-2 py-0.5 rounded-full bg-green-100 text-green-800'
                        : 'inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-600'
                    }
                  >
                    {m.enabled ? 'да' : 'нет'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                  <button
                    onClick={() => openIconUpload(m.id)}
                    className="text-xs text-ink-600 hover:text-primary"
                  >
                    Иконка
                  </button>
                  <button
                    onClick={() => openEdit(m)}
                    className="text-xs text-primary hover:underline"
                  >
                    Изменить
                  </button>
                  <button
                    onClick={() => setDeleteId(m.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-ink-400 text-sm">
                  Методы пока не созданы.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {showCreate && (
        <Modal title="Новый метод оплаты" onClose={() => setShowCreate(false)}>
          <MethodForm
            data={createForm}
            onChange={setCreateForm}
            error={createError}
            loading={createLoading}
            onSubmit={handleCreate}
            onCancel={() => setShowCreate(false)}
            submitLabel="Создать"
          />
        </Modal>
      )}

      {editRow && (
        <Modal title={`Метод: ${editRow.name}`} onClose={() => setEditRow(null)}>
          <MethodForm
            data={editForm}
            onChange={setEditForm}
            error={editError}
            loading={editLoading}
            onSubmit={handleEdit}
            onCancel={() => setEditRow(null)}
            submitLabel="Сохранить"
          />
        </Modal>
      )}

      {deleteId && (
        <Modal title="Удалить метод?" onClose={() => setDeleteId(null)}>
          <p className="text-sm text-ink-600 mb-4">
            Метод нельзя удалить, если он использовался в депозитах/выводах. Удалить только если ни одна транзакция к нему не привязана.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setDeleteId(null)}
              className="px-4 py-1.5 text-sm rounded-md border border-border text-ink-600 hover:bg-ink-50"
            >
              Отмена
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteLoading}
              className="px-4 py-1.5 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleteLoading ? 'Удаление…' : 'Удалить'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
