'use client';

import { useEffect, useState } from 'react';
import type { AdminCodePurchaseRow } from '../../../lib/api/admin';
import { minorToAzn } from '../../../lib/format';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

export function IssueCodeModal({
  target,
  onClose,
  onSubmit,
}: {
  target: AdminCodePurchaseRow | null;
  onClose: () => void;
  onSubmit: (id: string, code: string) => Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (target) setCode('');
  }, [target]);

  if (!target) return null;

  async function submit() {
    if (!target || !code.trim()) return;
    setLoading(true);
    try {
      await onSubmit(target.id, code.trim());
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Выдать код"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button variant="success" onClick={submit} loading={loading} disabled={!code.trim()}>
            Подтвердить
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-500 mb-3">
        Пользователю <span className="text-ink-900 font-medium">{target.username ?? target.userId}</span>{' '}
        будет списано <span className="text-ink-900 font-medium font-mono">{minorToAzn(target.amountMinor)}</span>,
        код опубликован в чате тикета.
      </p>
      <label className="block text-xs font-medium text-ink-500 mb-1.5">Код для выдачи</label>
      <Input
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="XXXXX-XXXXX-XXXXX"
      />
    </Modal>
  );
}
