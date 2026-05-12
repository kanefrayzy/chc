'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  adminApi,
  type AdminCodePurchaseRow,
  type CodePurchaseStatus,
} from '../../../lib/api/admin';
import { ApiException } from '../../../lib/api/client';
import { minorToAzn, formatDateTime, shortId } from '../../../lib/format';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/ui/DataTable';
import { CodePurchaseStatusFilter } from './CodePurchaseStatusFilter';
import { IssueCodeModal } from './IssueCodeModal';
import { RejectModal } from './RejectModal';

const statusTone: Record<CodePurchaseStatus, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  CREATED: 'neutral',
  AWAITING_MODERATOR: 'warning',
  CODE_ISSUED: 'info',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

const statusLabel: Record<CodePurchaseStatus, string> = {
  CREATED: 'Создана',
  AWAITING_MODERATOR: 'Ожидает модератора',
  CODE_ISSUED: 'Код выдан',
  COMPLETED: 'Завершена',
  CANCELLED: 'Отменена',
};

export function CodePurchasesTable({
  initialItems,
  status,
}: {
  initialItems: AdminCodePurchaseRow[];
  status: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [issueTarget, setIssueTarget] = useState<AdminCodePurchaseRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminCodePurchaseRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const res = await adminApi.codePurchases.list({ status, limit: 50 });
      setItems(res.items);
    } catch {
      router.refresh();
    }
  }

  async function onIssue(id: string, code: string) {
    setError(null);
    try {
      await adminApi.codePurchases.issue(id, { code });
      setIssueTarget(null);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Не удалось выдать код');
    }
  }

  async function onReject(id: string, reason: string) {
    setError(null);
    try {
      await adminApi.codePurchases.reject(id, { reason });
      setRejectTarget(null);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Не удалось отклонить');
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <CodePurchaseStatusFilter value={status} />
        <Button variant="ghost" size="sm" onClick={refresh}>
          Обновить
        </Button>
      </div>

      {error && (
        <div className="mb-3 text-sm text-danger">{error}</div>
      )}

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
            cell: (r) => (
              <span className="font-mono tabular-nums">{minorToAzn(r.amountMinor)}</span>
            ),
          },
          {
            key: 'status',
            header: 'Статус',
            cell: (r) => <Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge>,
          },
          {
            key: 'created',
            header: 'Создана',
            cell: (r) => <span className="text-sm text-ink-500">{formatDateTime(r.createdAt)}</span>,
          },
          {
            key: 'actions',
            header: '',
            align: 'right',
            cell: (r) => {
              const actionable =
                r.status === 'AWAITING_MODERATOR' || r.status === 'CREATED';
              if (!actionable) return null;
              return (
                <div className="flex items-center gap-2 justify-end">
                  <Button size="sm" variant="success" onClick={() => setIssueTarget(r)}>
                    Выдать код
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

      <IssueCodeModal
        target={issueTarget}
        onClose={() => setIssueTarget(null)}
        onSubmit={onIssue}
      />
      <RejectModal
        title="Отклонить покупку кода"
        target={rejectTarget}
        onClose={() => setRejectTarget(null)}
        onSubmit={onReject}
      />
    </div>
  );
}
