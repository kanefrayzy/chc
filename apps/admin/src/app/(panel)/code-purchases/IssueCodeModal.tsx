'use client';

import { useEffect, useState } from 'react';
import type { AdminCodePurchaseRow } from '../../../lib/api/admin';
import { minorToAzn } from '../../../lib/format';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

function displayToMinor(display: string): string {
  const cleaned = display.replace(/\s/g, '').replace(',', '.');
  if (!cleaned) return '0';
  const num = parseFloat(cleaned);
  if (Number.isNaN(num) || num <= 0) throw new Error('Введите положительную сумму');
  return String(Math.round(num * 100));
}

export function IssueCodeModal({
  target,
  onClose,
  onSubmit,
}: {
  target: AdminCodePurchaseRow | null;
  onClose: () => void;
  onSubmit: (id: string, code: string, amountMinor: string) => Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (target) {
      setCode('');
      setAmount('');
      setError(null);
    }
  }, [target]);

  if (!target) return null;

  const balance = target.userBalanceMinor;
  let willOverdraft = false;
  let amountMinorPreview = '0';
  try {
    if (amount) {
      amountMinorPreview = displayToMinor(amount);
      if (balance && BigInt(amountMinorPreview) > BigInt(balance)) willOverdraft = true;
    }
  } catch {
    /* invalid, обработаем в submit */
  }

  async function submit() {
    setError(null);
    if (!code.trim()) {
      setError('Введите код');
      return;
    }
    let amountMinor: string;
    try {
      amountMinor = displayToMinor(amount);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неверная сумма');
      return;
    }
    if (balance && BigInt(amountMinor) > BigInt(balance)) {
      setError('Сумма превышает баланс пользователя');
      return;
    }
    setLoading(true);
    try {
      if (target) {
        await onSubmit(target.id, code.trim(), amountMinor);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Выдать код и списать средства"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button
            variant="success"
            onClick={submit}
            loading={loading}
            disabled={!code.trim() || !amount || willOverdraft}
          >
            Подтвердить
          </Button>
        </>
      }
    >
      <div className="mb-4 rounded-lg border border-border bg-ink-50 p-3">
        <div className="text-xs text-ink-500 mb-0.5">
          Пользователь <span className="text-ink-900 font-medium">{target.username ?? target.userId}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-ink-500">Баланс:</span>
          <span className={`text-xl font-mono font-semibold ${willOverdraft ? 'text-red-600' : 'text-ink-900'}`}>
            {balance ? minorToAzn(balance) : '—'}
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <label className="block text-xs font-medium text-ink-500 mb-1.5">Сумма списания, AZN</label>
      <Input
        autoFocus
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="100"
        inputMode="decimal"
      />
      {willOverdraft && (
        <p className="mt-1 text-xs text-red-600">Сумма превышает баланс — списание невозможно.</p>
      )}

      <label className="mt-3 block text-xs font-medium text-ink-500 mb-1.5">Код для выдачи</label>
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="XXXXX-XXXXX-XXXXX"
      />
    </Modal>
  );
}
