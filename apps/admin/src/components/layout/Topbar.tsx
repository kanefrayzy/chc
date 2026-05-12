'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { adminAuthApi } from '../../lib/api/auth';
import { Button } from '../ui/Button';

export function Topbar({ email }: { email: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    setLoading(true);
    try {
      await adminAuthApi.logout();
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }

  return (
    <header className="h-14 bg-surface border-b border-border px-6 flex items-center justify-between">
      <div className="text-sm text-ink-500">
        Панель управления
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-ink-700">{email}</span>
        <Button variant="ghost" size="sm" onClick={onLogout} loading={loading}>
          Выйти
        </Button>
      </div>
    </header>
  );
}
