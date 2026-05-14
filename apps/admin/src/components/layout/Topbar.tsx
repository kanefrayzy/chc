'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { adminAuthApi } from '../../lib/api/auth';

export function Topbar({ email }: { email: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    setLoading(true);
    try { await adminAuthApi.logout(); } finally {
      router.replace('/login');
      router.refresh();
    }
  }

  return (
    <header className="h-14 bg-surface border-b border-border px-6 flex items-center justify-between shrink-0">
      {/* Breadcrumb area — empty, pages use PageHeader */}
      <div />
      {/* Right side */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-ink-500 hidden sm:block">{email}</span>
        <button
          onClick={onLogout}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-danger disabled:opacity-50 transition-colors px-2 py-1 rounded-lg hover:bg-danger/8"
        >
          {loading
            ? <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-r-transparent animate-spin" />
            : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            )}
          <span className="hidden sm:inline">Выйти</span>
        </button>
      </div>
    </header>
  );
}
