'use client';

import { useRef, useState } from 'react';
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
  const [logoUploading, setLogoUploading] = useState(false);
  const [imageUploadingKey, setImageUploadingKey] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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

  async function onLogoUpload(file: File) {
    setError(null);
    setLogoUploading(true);
    try {
      const updated = await adminApi.settings.uploadLogo(file);
      setItems((prev) => prev.map((s) => (s.key === updated.key ? updated : s)));
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Не удалось загрузить логотип');
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  }

  async function onImageUpload(key: string, file: File) {
    setError(null);
    setImageUploadingKey(key);
    try {
      const updated = await adminApi.settings.uploadImage(key, file);
      setItems((prev) => prev.map((s) => (s.key === updated.key ? updated : s)));
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Не удалось загрузить изображение');
    } finally {
      setImageUploadingKey(null);
      const inp = imageInputRefs.current[key];
      if (inp) inp.value = '';
    }
  }

  function isImageKey(key: string): boolean {
    return (
      key === 'brand.hero_image_url' ||
      key.startsWith('landing.game_image_url.')
    );
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
              <div className="flex items-center gap-2 justify-end">
                {s.key === 'brand.logo_url' && (
                  <>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void onLogoUpload(f);
                      }}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={logoUploading}
                      onClick={() => logoInputRef.current?.click()}
                    >
                      Загрузить файл
                    </Button>
                  </>
                )}
                {isImageKey(s.key) && (
                  <>
                    <input
                      ref={(el) => {
                        imageInputRefs.current[s.key] = el;
                      }}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void onImageUpload(s.key, f);
                      }}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={imageUploadingKey === s.key}
                      onClick={() => imageInputRefs.current[s.key]?.click()}
                    >
                      Загрузить изображение
                    </Button>
                  </>
                )}
                <Button size="sm" variant="secondary" onClick={() => setTarget(s)}>
                  Изменить
                </Button>
              </div>
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
