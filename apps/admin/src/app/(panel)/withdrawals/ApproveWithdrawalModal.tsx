'use client';

import { useEffect, useState } from 'react';
import type { AdminWithdrawalRow } from '../../../lib/api/admin';
import { minorToAzn } from '../../../lib/format';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input, Textarea } from '../../../components/ui/Input';

export function ApproveWithdrawalModal({
  target,
  onClose,
  onSubmit,
}: {
  target: AdminWithdrawalRow | null;
  onClose: () => void;
  onSubmit: (id: string, externalId?: string, note?: string) => Promise<void>;
}) {
  const [externalId, setExternalId] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (target) {
      setExternalId('');
      setNote('');
    }
  }, [target]);

  if (!target) return null;

  async function submit() {
    if (!target) return;
    setLoading(true);
    try {
      await onSubmit(target.id, externalId.trim() || undefined, note.trim() || undefined);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Подтвердить вывод"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button variant="success" onClick={submit} loading={loading}>
            Подтвердить
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-500 mb-3">
        Будет финализирован hold{' '}
        <span className="font-mono font-medium text-ink-900">{minorToAzn(target.amountMinor)}</span>
        {' '}для <span className="text-ink-900 font-medium">{target.username ?? target.userId}</span>.
        Реквизиты:{' '}
        <span className="font-mono">{target.destination.display}</span>.
      </p>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1.5">
            ID транзакции (опционально)
          </label>
          <Input
            value={externalId}
            onChange={(e) => setExternalId(e.target.value)}
            placeholder="hash / payment id"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1.5">
            Заметка (опционально)
          </label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        </div>
      </div>
    </Modal>
  );
}
