'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  adminApi,
  type AdminWithdrawalRow,
  type WithdrawalStatus,
} from '../../../lib/api/admin';
import { ApiException } from '../../../lib/api/client';
import { minorToAzn, formatDateTime, shortId } from '../../../lib/format';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/ui/DataTable';
import { WithdrawalStatusFilter } from './WithdrawalStatusFilter';
import { ApproveWithdrawalModal } from './ApproveWithdrawalModal';
import { RejectModal } from '../code-purchases/RejectModal';

const statusTone: Record<
  WithdrawalStatus,
  'neutral' | 'info' | 'warning' | 'success' | 'danger'
> = {
  PENDING: 'warning',
  PROCESSING: 'info',
  COMPLETED: 'success',
  REJECTED: 'danger',
  FAILED: 'danger',
  CANCELLED: 'neutral',
};

const statusLabel: Record<WithdrawalStatus, string> = {
  PENDING: 'Ожидает',
  PROCESSING: 'В работе',
  COMPLETED: 'Завершён',
  REJECTED: 'Отклонён',
  FAILED: 'Ошибка',
  CANCELLED: 'Отменён',
};

const methodLabel: Record<AdminWithdrawalRow['method'], string> = {
  AUTO_BETRA_H2H: 'Карта (Betra)',
  AUTO_WESTWALLET: 'Крипто (Westwallet)',
  MANUAL_MODERATOR: 'Вручную',
};

export function WithdrawalsTable({
  initialItems,
  status,
}: {
  initialItems: AdminWithdrawalRow[];
  status: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [approveTarget, setApproveTarget] = useState<AdminWithdrawalRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminWithdrawalRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const res = await adminApi.withdrawals.list({ status, limit: 50 });
      setItems(res.items);
    } catch {
      router.refresh();
    }
  }

  async function onApprove(id: string, externalId?: string, note?: string) {
    setError(null);
    try {
      await adminApi.withdrawals.approve(id, { externalId, note });
      setApproveTarget(null);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Не удалось подтвердить');
    }
  }

  async function onReject(id: string, reason: string) {
    setError(null);
    try {
      await adminApi.withdrawals.reject(id, { reason });
      setRejectTarget(null);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Не удалось отклонить');
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <WithdrawalStatusFilter value={status} />
        <Button variant="ghost" size="sm" onClick={refresh}>
          Обновить
        </Button>
      </div>

      {error && <div className="mb-3 text-sm text-danger">{error}</div>}

      <DataTable
        rows={items}
        empty="Нет заявок"
        columns={[
          {
            key: 'id',
            header: 'ID',
            cell: (r) => <span className="font-mono text-xs text-ink-500">{shortId(r.id)}</span>,
          },
          {
            key: 'user',
            header: 'Пользователь',
            cell: (r) => (
              <div>
                <div className="text-sm text-ink-900">{r.username ?? '—'}</div>
                <div className="text-xs text-ink-400 font-mono">{shortId(r.userId)}</div>
              </div>
            ),
          },
          {
            key: 'amount',
            header: 'Сумма',
            align: 'right',
            cell: (r) => <span className="font-mono tabular-nums">{minorToAzn(r.amountMinor)}</span>,
          },
          {
            key: 'method',
            header: 'Метод',
            cell: (r) => (
              <div>
                <div className="text-sm text-ink-700">{methodLabel[r.method]}</div>
                <div className="text-xs text-ink-400 font-mono">{r.destination.display}</div>
              </div>
            ),
          },
          {
            key: 'status',
            header: 'Статус',
            cell: (r) => <Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge>,
          },
          {
            key: 'created',
            header: 'Создан',
            cell: (r) => <span className="text-sm text-ink-500">{formatDateTime(r.createdAt)}</span>,
          },
          {
            key: 'actions',
            header: '',
            align: 'right',
            cell: (r) => {
              if (r.status !== 'PENDING' && r.status !== 'PROCESSING') return null;
              return (
                <div className="flex items-center gap-2 justify-end">
                  <Button size="sm" variant="success" onClick={() => setApproveTarget(r)}>
                    Подтвердить
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setRejectTarget(r)}>
                    Отклонить
                  </Button>
                </div>
              );
            },
          },
        ]}
      />

      <ApproveWithdrawalModal
        target={approveTarget}
        onClose={() => setApproveTarget(null)}
        onSubmit={onApprove}
      />
      <RejectModal
        title="Отклонить вывод"
        target={rejectTarget}
        onClose={() => setRejectTarget(null)}
        onSubmit={onReject}
      />
    </div>
  );
}
