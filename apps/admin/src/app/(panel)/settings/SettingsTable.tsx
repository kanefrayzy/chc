'use client';

import { useState } from 'react';
import { adminApi, type AdminSettingRow } from '../../../lib/api/admin';
import { ApiException } from '../../../lib/api/client';
import { formatDateTime } from '../../../lib/format';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/ui/DataTable';
import { SettingEditModal } from './SettingEditModal';

export function SettingsTable({ initialItems }: { initialItems: AdminSettingRow[] }) {
  const [items, setItems] = useState(initialItems);
  const [target, setTarget] = useState<AdminSettingRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(key: string, value: unknown) {
    setError(null);
    try {
      const updated = await adminApi.settings.set(key, value);
      setItems((prev) => prev.map((s) => (s.key === key ? updated : s)));
      setTarget(null);
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Не удалось сохранить');
    }
  }

  // rows must have `id` field for DataTable
  const rows = items.map((s) => ({ ...s, id: s.key }));

  return (
    <div>
      {error && <div className="mb-3 text-sm text-danger">{error}</div>}
      <DataTable
        rows={rows}
        empty="Нет настроек"
        columns={[
          {
            key: 'key',
            header: 'Ключ',
            cell: (s) => (
              <div>
                <div className="font-mono text-xs text-ink-900">{s.key}</div>
                <div className="text-xs text-ink-500 mt-0.5">{s.description}</div>
              </div>
            ),
          },
          {
            key: 'type',
            header: 'Тип',
            cell: (s) => (
              <Badge tone="neutral" className="font-mono">
                {s.type}
              </Badge>
            ),
          },
          {
            key: 'value',
            header: 'Значение',
            cell: (s) => (
              <code className="font-mono text-sm text-ink-900">
                {JSON.stringify(s.value)}
              </code>
            ),
          },
          {
            key: 'public',
            header: 'Видимость',
            cell: (s) =>
              s.isPublic ? (
                <Badge tone="info">public</Badge>
              ) : (
                <Badge tone="neutral">private</Badge>
              ),
          },
          {
            key: 'state',
            header: 'Источник',
            cell: (s) =>
              s.isDefault ? (
                <Badge tone="neutral">default</Badge>
              ) : (
                <Badge tone="accent">custom</Badge>
              ),
          },
          {
            key: 'updated',
            header: 'Изменено',
            cell: (s) => (
              <span className="text-xs text-ink-500">
                {s.updatedAt ? formatDateTime(s.updatedAt) : '—'}
              </span>
            ),
          },
          {
            key: 'actions',
            header: '',
            align: 'right',
            cell: (s) => (
              <Button size="sm" variant="secondary" onClick={() => setTarget(s)}>
                Изменить
              </Button>
            ),
          },
        ]}
      />

      <SettingEditModal
        target={target}
        onClose={() => setTarget(null)}
        onSubmit={onSubmit}
      />
    </div>
  );
}
