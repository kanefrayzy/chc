'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '../../../lib/cn';

const OPTIONS: { value: string; label: string }[] = [
  { value: 'AWAITING_MODERATOR', label: 'Ожидают' },
  { value: 'COMPLETED', label: 'Завершены' },
  { value: 'CANCELLED', label: 'Отменены' },
];

export function CodePurchaseStatusFilter({ value }: { value: string }) {
  const router = useRouter();
  const params = useSearchParams();

  function setStatus(next: string) {
    const usp = new URLSearchParams(params);
    usp.set('status', next);
    router.replace(`?${usp.toString()}`);
  }

  return (
    <div className="inline-flex items-center bg-page rounded-md border border-border p-0.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setStatus(opt.value)}
          className={cn(
            'px-3 py-1 text-xs font-medium rounded',
            value === opt.value ? 'bg-surface text-ink-900 shadow-card' : 'text-ink-500 hover:text-ink-900',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
