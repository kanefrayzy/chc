'use client';

import { useEffect, useState } from 'react';
import type { AdminUserRow } from '../../../lib/api/admin';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Textarea } from '../../../components/ui/Input';
import { cn } from '../../../lib/cn';

const OPTIONS: { value: AdminUserRow['status']; label: string; tone: string }[] = [
  { value: 'ACTIVE', label: 'ACTIVE — обычный', tone: 'border-success text-success' },
  { value: 'MUTED', label: 'MUTED — без чата', tone: 'border-warning text-warning' },
  { value: 'BANNED', label: 'BANNED — заблокирован', tone: 'border-danger text-danger' },
];

export function UserStatusModal({
  target,
  onClose,
  onSubmit,
}: {
  target: AdminUserRow | null;
  onClose: () => void;
  onSubmit: (id: string, status: AdminUserRow['status'], reason?: string) => Promise<void>;
}) {
  const [status, setStatus] = useState<AdminUserRow['status']>('ACTIVE');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (target) {
      setStatus(target.status);
      setReason('');
    }
  }, [target]);

  if (!target) return null;

  async function submit() {
    if (!target) return;
    setLoading(true);
    try {
      await onSubmit(target.id, status, reason.trim() || undefined);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Статус · ${target.username}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button variant="primary" onClick={submit} loading={loading}>
            Сохранить
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        {OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 border rounded-md cursor-pointer',
              status === opt.value
                ? `bg-page ${opt.tone}`
                : 'border-border text-ink-700 hover:bg-page',
            )}
          >
            <input
              type="radio"
              name="status"
              value={opt.value}
              checked={status === opt.value}
              onChange={() => setStatus(opt.value)}
            />
            <span className="text-sm font-medium">{opt.label}</span>
          </label>
        ))}
      </div>
      <div className="mt-3">
        <label className="block text-xs font-medium text-ink-500 mb-1.5">
          Причина (опционально)
        </label>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
      </div>
    </Modal>
  );
}
