'use client';

import { useState, useRef } from 'react';
import { adminApi, type AdminRankRow } from '../../../lib/api/admin';
import { Card } from '../../../components/ui/Card';
import { Alert } from '../../../components/ui/Alert';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function minorToDisplay(minor: string): string {
  const n = BigInt(minor);
  if (n === 0n) return '0';
  const whole = n / 100n;
  const frac = n % 100n;
  if (frac === 0n) return whole.toLocaleString('ru-RU');
  return `${whole.toLocaleString('ru-RU')}.${String(frac).padStart(2, '0')}`;
}

function displayToMinor(display: string): string {
  const cleaned = display.replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  if (isNaN(num) || num < 0) throw new Error('Invalid number');
  return String(Math.round(num * 100));
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-ink-400 hover:text-ink-700 text-xl leading-none"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── RankForm ─────────────────────────────────────────────────────────────────

interface RankFormData {
  order: string;
  slug: string;
  nameRu: string;
  nameAz: string;
  minWageredDisplay: string;
}

function emptyForm(): RankFormData {
  return { order: '', slug: '', nameRu: '', nameAz: '', minWageredDisplay: '' };
}

function rankToForm(r: AdminRankRow): RankFormData {
  return {
    order: String(r.order),
    slug: r.slug,
    nameRu: r.nameRu,
    nameAz: r.nameAz,
    minWageredDisplay: minorToDisplay(r.minWageredMinor),
  };
}

interface RankFormProps {
  data: RankFormData;
  onChange: (data: RankFormData) => void;
  error?: string;
  loading?: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
}

function RankForm({ data, onChange, error, loading, onSubmit, onCancel, submitLabel }: RankFormProps) {
  const f = (field: keyof RankFormData) => ({
    value: data[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...data, [field]: e.target.value }),
  });

  return (
    <div className="space-y-3">
      {error && (
        <Alert tone="danger">{error}</Alert>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-ink-600 mb-1">Порядок</label>
          <input
            type="number"
            min={0}
            className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-surface text-ink-900"
            placeholder="0"
            {...f('order')}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-600 mb-1">Slug</label>
          <input
            type="text"
            className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-surface text-ink-900"
            placeholder="novice"
            {...f('slug')}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-600 mb-1">Название (RU)</label>
        <input
          type="text"
          className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-surface text-ink-900"
          placeholder="Новичок"
          {...f('nameRu')}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-600 mb-1">Название (AZ)</label>
        <input
          type="text"
          className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-surface text-ink-900"
          placeholder="Yeni"
          {...f('nameAz')}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-600 mb-1">Мин. ставки (₽)</label>
        <input
          type="text"
          className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-surface text-ink-900"
          placeholder="0"
          {...f('minWageredDisplay')}
        />
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

// ─── RanksPanel ───────────────────────────────────────────────────────────────

export function RanksPanel({ initialItems }: { initialItems: AdminRankRow[] }) {
  const [items, setItems] = useState<AdminRankRow[]>(initialItems);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // ── Create modal ──────────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<RankFormData>(emptyForm());
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  async function handleCreate() {
    setCreateError(null);
    let minWageredMinor: string;
    try { minWageredMinor = displayToMinor(createForm.minWageredDisplay); }
    catch { setCreateError('Неверный формат суммы'); return; }
    if (!createForm.slug.match(/^[a-z0-9_-]+$/)) {
      setCreateError('Slug: только строчные буквы, цифры, _ и -'); return;
    }
    setCreateLoading(true);
    try {
      const rank = await adminApi.ranks.create({
        order: Number(createForm.order),
        slug: createForm.slug,
        nameRu: createForm.nameRu,
        nameAz: createForm.nameAz,
        minWageredMinor,
        iconUrl: null,
      });
      setItems((prev) => [...prev, rank].sort((a, b) => a.order - b.order));
      setShowCreate(false);
      setCreateForm(emptyForm());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка создания ранга';
      setCreateError(msg);
    } finally {
      setCreateLoading(false);
    }
  }

  // ── Edit modal ────────────────────────────────────────────────────────────
  const [editRank, setEditRank] = useState<AdminRankRow | null>(null);
  const [editForm, setEditForm] = useState<RankFormData>(emptyForm());
  const [editError, setEditError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  function openEdit(r: AdminRankRow) {
    setEditRank(r);
    setEditForm(rankToForm(r));
    setEditError(null);
  }

  async function handleEdit() {
    if (!editRank) return;
    setEditError(null);
    let minWageredMinor: string;
    try { minWageredMinor = displayToMinor(editForm.minWageredDisplay); }
    catch { setEditError('Неверный формат суммы'); return; }
    setEditLoading(true);
    try {
      const rank = await adminApi.ranks.update(editRank.id, {
        order: Number(editForm.order),
        slug: editForm.slug,
        nameRu: editForm.nameRu,
        nameAz: editForm.nameAz,
        minWageredMinor,
      });
      setItems((prev) => prev.map((r) => (r.id === rank.id ? rank : r)).sort((a, b) => a.order - b.order));
      setEditRank(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка сохранения';
      setEditError(msg);
    } finally {
      setEditLoading(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleteLoading(true);
    setGlobalError(null);
    try {
      await adminApi.ranks.remove(deleteId);
      setItems((prev) => prev.filter((r) => r.id !== deleteId));
      setDeleteId(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка удаления';
      setGlobalError(msg);
    } finally {
      setDeleteLoading(false);
    }
  }

  // ── Icon upload ───────────────────────────────────────────────────────────
  const [iconUploadId, setIconUploadId] = useState<string | null>(null);
  const [iconLoading, setIconLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingIconRankId, setPendingIconRankId] = useState<string | null>(null);

  function openIconUpload(rankId: string) {
    setPendingIconRankId(rankId);
    fileInputRef.current?.click();
  }

  async function handleIconChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !pendingIconRankId) return;
    setIconUploadId(pendingIconRankId);
    setIconLoading(true);
    setGlobalError(null);
    try {
      const rank = await adminApi.ranks.uploadIcon(pendingIconRankId, file);
      setItems((prev) => prev.map((r) => (r.id === rank.id ? rank : r)));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка загрузки иконки';
      setGlobalError(msg);
    } finally {
      setIconLoading(false);
      setIconUploadId(null);
      setPendingIconRankId(null);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={handleIconChange}
      />

      {globalError && (
        <Alert tone="danger" className="mb-4">{globalError}</Alert>
      )}

      <div className="mb-4 flex justify-end">
        <button
          onClick={() => { setShowCreate(true); setCreateForm(emptyForm()); setCreateError(null); }}
          className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90"
        >
          + Добавить ранг
        </button>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-ink-500 uppercase tracking-wider">
              <th className="px-4 py-3 w-12">#</th>
              <th className="px-4 py-3">Иконка</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Назв. RU</th>
              <th className="px-4 py-3">Назв. AZ</th>
              <th className="px-4 py-3">Мин. ставки</th>
              <th className="px-4 py-3 text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((r) => (
              <tr key={r.id} className="hover:bg-ink-50/50">
                <td className="px-4 py-3 text-ink-500">{r.order}</td>
                <td className="px-4 py-3">
                  {r.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.iconUrl} alt={r.slug} className="h-8 w-8 object-contain rounded" />
                  ) : (
                    <span className="text-ink-400 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-ink-700">{r.slug}</td>
                <td className="px-4 py-3 text-ink-900">{r.nameRu}</td>
                <td className="px-4 py-3 text-ink-700">{r.nameAz}</td>
                <td className="px-4 py-3 text-ink-700 font-mono text-xs">
                  {minorToDisplay(r.minWageredMinor)} ₽
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => openIconUpload(r.id)}
                      disabled={iconLoading && iconUploadId === r.id}
                      title="Загрузить иконку"
                      className="px-2 py-1 text-xs rounded bg-ink-100 hover:bg-ink-200 text-ink-700 disabled:opacity-50"
                    >
                      {iconLoading && iconUploadId === r.id ? '…' : '🖼'}
                    </button>
                    <button
                      onClick={() => openEdit(r)}
                      title="Редактировать"
                      className="px-2 py-1 text-xs rounded bg-ink-100 hover:bg-ink-200 text-ink-700"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => setDeleteId(r.id)}
                      title="Удалить"
                      className="px-2 py-1 text-xs rounded bg-red-50 hover:bg-red-100 text-red-600"
                    >
                      🗑
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink-400">
                  Рангов пока нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Create modal */}
      {showCreate && (
        <Modal title="Новый ранг" onClose={() => setShowCreate(false)}>
          <RankForm
            data={createForm}
            onChange={setCreateForm}
            error={createError ?? undefined}
            loading={createLoading}
            onSubmit={handleCreate}
            onCancel={() => setShowCreate(false)}
            submitLabel="Создать"
          />
        </Modal>
      )}

      {/* Edit modal */}
      {editRank && (
        <Modal title={`Редактировать: ${editRank.nameRu}`} onClose={() => setEditRank(null)}>
          <RankForm
            data={editForm}
            onChange={setEditForm}
            error={editError ?? undefined}
            loading={editLoading}
            onSubmit={handleEdit}
            onCancel={() => setEditRank(null)}
            submitLabel="Сохранить"
          />
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <Modal title="Удалить ранг?" onClose={() => setDeleteId(null)}>
          <p className="text-sm text-ink-600 mb-4">
            Это действие нельзя отменить. Пользователи с этим рангом потеряют его при следующей синхронизации.
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
