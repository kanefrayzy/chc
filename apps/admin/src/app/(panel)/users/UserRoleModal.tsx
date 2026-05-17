'use client';

import { useState } from 'react';
import type { AdminUserRow } from '../../../lib/api/admin';
import { Button } from '../../../components/ui/Button';

const ROLES: { value: AdminUserRow['role']; label: string }[] = [
  { value: 'USER', label: 'Пользователь' },
  { value: 'MODERATOR', label: 'Модератор' },
  { value: 'SUPER_ADMIN', label: 'Администратор' },
];

export function UserRoleModal({
  target,
  onClose,
  onSubmit,
}: {
  target: AdminUserRow | null;
  onClose: () => void;
  onSubmit: (id: string, role: AdminUserRow['role']) => Promise<void>;
}) {
  const [role, setRole] = useState<AdminUserRow['role']>('USER');
  const [loading, setLoading] = useState(false);

  if (!target) return null;

  async function handleSubmit() {
    setLoading(true);
    try {
      await onSubmit(target!.id, role);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h3 className="text-base font-semibold text-ink-900 mb-1">Изменить роль</h3>
        <p className="text-sm text-ink-500 mb-4">{target.username}</p>

        <div className="space-y-2 mb-5">
          {ROLES.map((r) => (
            <label key={r.value} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="role"
                value={r.value}
                checked={role === r.value}
                defaultChecked={target.role === r.value}
                onChange={() => setRole(r.value)}
                className="accent-primary"
              />
              <span className="text-sm text-ink-900">{r.label}</span>
              {target.role === r.value && (
                <span className="text-xs text-ink-400">(текущая)</span>
              )}
            </label>
          ))}
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={loading}>
            Отмена
          </Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={loading || role === target.role}>
            {loading ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </div>
    </div>
  );
}
