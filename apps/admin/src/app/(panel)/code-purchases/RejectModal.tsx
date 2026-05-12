'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Textarea } from '../../../components/ui/Input';

export function RejectModal<T extends { id: string }>({
  title,
  target,
  onClose,
  onSubmit,
}: {
  title: string;
  target: T | null;
  onClose: () => void;
  onSubmit: (id: string, reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (target) setReason('');
  }, [target]);

  if (!target) return null;

  async function submit() {
    if (!target || reason.trim().length < 3) return;
    setLoading(true);
    try {
      await onSubmit(target.id, reason.trim());
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button variant="danger" onClick={submit} loading={loading} disabled={reason.trim().length < 3}>
            Отклонить
          </Button>
        </>
      }
    >
      <label className="block text-xs font-medium text-ink-500 mb-1.5">Причина (видна пользователю)</label>
      <Textarea
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Минимум 3 символа"
        rows={4}
      />
    </Modal>
  );
}
