'use client';

import { useEffect, useState } from 'react';
import type { AdminUserRow } from '../../../lib/api/admin';
import { minorToAzn, parseAmountToMinor } from '../../../lib/format';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input, Textarea } from '../../../components/ui/Input';
import { Alert } from '../../../components/ui/Alert';

export function BalanceAdjustModal({
  target,
  onClose,
  onSubmit,
}: {
  target: AdminUserRow | null;
  onClose: () => void;
  onSubmit: (id: string, amountMinor: string, reason: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (target) {
      setAmount('');
      setReason('');
      setError(null);
    }
  }, [target]);

  if (!target) return null;

  async function submit() {
    if (!target) return;
    setError(null);
    let minor: bigint;
    try {
      minor = parseAmountToMinor(amount);
    } catch {
      setError('Введите сумму в AZN. Например: 50.00 или -25.50');
      return;
    }
    if (minor === 0n) {
      setError('Сумма не может быть нулевой.');
      return;
    }
    if (reason.trim().length < 3) {
      setError('Укажите причину (минимум 3 символа).');
      return;
    }
    setLoading(true);
    try {
      await onSubmit(target.id, minor.toString(), reason.trim());
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Коррекция баланса · ${target.username}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button variant="primary" onClick={submit} loading={loading}>
            Применить
          </Button>
        </>
      }
    >
      <div className="mb-3 text-sm text-ink-500">
        Текущий баланс:{' '}
        <span className="font-mono font-medium text-ink-900">{minorToAzn(target.balanceMinor)}</span>
      </div>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1.5">
            Сумма в AZN (отрицательное — списание)
          </label>
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="например 100.00 или -50.00"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1.5">
            Причина (попадёт в audit log)
          </label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </div>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}
