'use client';

import { useEffect, useState } from 'react';
import type { AdminSettingRow } from '../../../lib/api/admin';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input, Textarea } from '../../../components/ui/Input';
import { Alert } from '../../../components/ui/Alert';
import { cn } from '../../../lib/cn';

export function SettingEditModal({
  target,
  onClose,
  onSubmit,
}: {
  target: AdminSettingRow | null;
  onClose: () => void;
  onSubmit: (key: string, value: unknown) => Promise<void>;
}) {
  const [raw, setRaw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (target) {
      setRaw(formatInitial(target));
      setError(null);
    }
  }, [target]);

  if (!target) return null;

  async function submit() {
    if (!target) return;
    setError(null);
    let parsed: unknown;
    try {
      parsed = parseInput(target.type, raw);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Некорректное значение');
      return;
    }
    setLoading(true);
    try {
      await onSubmit(target.key, parsed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Изменить · ${target.key}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button variant="primary" onClick={submit} loading={loading}>
            Сохранить
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-500 mb-3">{target.description}</p>
      <div className="text-xs text-ink-400 mb-3 font-mono">
        type: {target.type} · текущее: {JSON.stringify(target.value)}
      </div>

      {target.type === 'boolean' ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRaw('true')}
            className={cn(
              'flex-1 py-2 rounded-md border text-sm font-medium',
              raw === 'true'
                ? 'bg-success-tint text-success border-success'
                : 'border-border text-ink-700 hover:bg-page',
            )}
          >
            true
          </button>
          <button
            type="button"
            onClick={() => setRaw('false')}
            className={cn(
              'flex-1 py-2 rounded-md border text-sm font-medium',
              raw === 'false'
                ? 'bg-danger-tint text-danger border-danger'
                : 'border-border text-ink-700 hover:bg-page',
            )}
          >
            false
          </button>
        </div>
      ) : target.type === 'json' ? (
        <Textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={6} className="font-mono" />
      ) : (
        <Input
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={target.type === 'number' ? 'число' : 'строка'}
        />
      )}

      {error && <Alert tone="danger" className="mt-3">{error}</Alert>}
    </Modal>
  );
}

function formatInitial(s: AdminSettingRow): string {
  if (s.type === 'boolean') return s.value ? 'true' : 'false';
  if (s.type === 'string') return String(s.value ?? '');
  if (s.type === 'number') return String(s.value ?? '');
  return JSON.stringify(s.value, null, 2);
}

function parseInput(type: AdminSettingRow['type'], raw: string): unknown {
  switch (type) {
    case 'boolean':
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      throw new Error('Значение должно быть true или false');
    case 'string':
      return raw;
    case 'number': {
      const n = Number(raw);
      if (!Number.isFinite(n)) throw new Error('Введите конечное число');
      return n;
    }
    case 'json':
      try {
        return JSON.parse(raw);
      } catch {
        throw new Error('Некорректный JSON');
      }
  }
}
