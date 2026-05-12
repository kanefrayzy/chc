'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, type AdminUserRow } from '../../../lib/api/admin';
import { ApiException } from '../../../lib/api/client';
import { minorToAzn, formatDateTime, shortId } from '../../../lib/format';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { DataTable } from '../../../components/ui/DataTable';
import { BalanceAdjustModal } from './BalanceAdjustModal';
import { UserStatusModal } from './UserStatusModal';

const statusTone: Record<AdminUserRow['status'], 'success' | 'warning' | 'danger'> = {
  ACTIVE: 'success',
  MUTED: 'warning',
  BANNED: 'danger',
};

const roleLabel: Record<AdminUserRow['role'], string> = {
  USER: 'Пользователь',
  MODERATOR: 'Модератор',
  SUPER_ADMIN: 'Админ',
};

export function UsersTable({
  initialItems,
  search,
  canAdjust,
}: {
  initialItems: AdminUserRow[];
  search: string;
  canAdjust: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState(search);
  const [adjustTarget, setAdjustTarget] = useState<AdminUserRow | null>(null);
  const [statusTarget, setStatusTarget] = useState<AdminUserRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function applySearch(e: FormEvent) {
    e.preventDefault();
    const usp = new URLSearchParams();
    if (query) usp.set('search', query);
    router.replace(`?${usp.toString()}`);
    try {
      const res = await adminApi.users.list({ search: query || undefined, limit: 50 });
      setItems(res.items);
    } catch {
      router.refresh();
    }
  }

  async function onAdjust(id: string, amountMinor: string, reason: string) {
    setError(null);
    try {
      const updated = await adminApi.users.adjustBalance(id, { amountMinor, reason });
      setItems((prev) => prev.map((u) => (u.id === id ? updated : u)));
      setAdjustTarget(null);
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Не удалось скорректировать баланс');
    }
  }

  async function onSetStatus(id: string, status: AdminUserRow['status'], reason?: string) {
    setError(null);
    try {
      const updated = await adminApi.users.setStatus(id, { status, reason });
      setItems((prev) => prev.map((u) => (u.id === id ? updated : u)));
      setStatusTarget(null);
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Не удалось изменить статус');
    }
  }

  return (
    <div>
      <form onSubmit={applySearch} className="mb-4 flex items-center gap-2 max-w-md">
        <Input
          placeholder="Поиск по username / email / phone / id"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button type="submit" variant="secondary">Найти</Button>
      </form>

      {error && <div className="mb-3 text-sm text-danger">{error}</div>}

      <DataTable
        rows={items}
        empty="Пользователи не найдены"
        columns={[
          {
            key: 'user',
            header: 'Пользователь',
            cell: (u) => (
              <div>
                <div className="text-sm text-ink-900 font-medium">{u.username}</div>
                <div className="text-xs text-ink-500">{u.email}</div>
                <div className="text-xs text-ink-400 font-mono">{shortId(u.id)}</div>
              </div>
            ),
          },
          {
            key: 'role',
            header: 'Роль',
            cell: (u) => (
              <Badge tone={u.role === 'SUPER_ADMIN' ? 'primary' : u.role === 'MODERATOR' ? 'info' : 'neutral'}>
                {roleLabel[u.role]}
              </Badge>
            ),
          },
          {
            key: 'status',
            header: 'Статус',
            cell: (u) => <Badge tone={statusTone[u.status]}>{u.status}</Badge>,
          },
          {
            key: 'balance',
            header: 'Баланс',
            align: 'right',
            cell: (u) => <span className="font-mono tabular-nums">{minorToAzn(u.balanceMinor)}</span>,
          },
          {
            key: 'wagered',
            header: 'Wagered',
            align: 'right',
            cell: (u) => (
              <span className="font-mono tabular-nums text-ink-500">{minorToAzn(u.totalWageredMinor)}</span>
            ),
          },
          {
            key: 'created',
            header: 'Регистрация',
            cell: (u) => <span className="text-sm text-ink-500">{formatDateTime(u.createdAt)}</span>,
          },
          {
            key: 'actions',
            header: '',
            align: 'right',
            cell: (u) => (
              <div className="flex items-center gap-2 justify-end">
                {canAdjust && (
                  <Button size="sm" variant="secondary" onClick={() => setAdjustTarget(u)}>
                    Баланс
                  </Button>
                )}
                {canAdjust && (
                  <Button size="sm" variant="ghost" onClick={() => setStatusTarget(u)}>
                    Статус
                  </Button>
                )}
              </div>
            ),
          },
        ]}
      />

      <BalanceAdjustModal
        target={adjustTarget}
        onClose={() => setAdjustTarget(null)}
        onSubmit={onAdjust}
      />
      <UserStatusModal
        target={statusTarget}
        onClose={() => setStatusTarget(null)}
        onSubmit={onSetStatus}
      />
    </div>
  );
}
