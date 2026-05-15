'use client';

import { useState, useTransition } from 'react';
import { adminApi } from '../../../lib/api/admin';

export function ExchangeRatesRefreshButton() {
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRefresh() {
    setResult(null);
    setError(null);
    startTransition(async () => {
      try {
        const rates = await adminApi.exchangeRates.refresh();
        setResult(
          `Курсы обновлены: 1 AZN = ${rates.usd} USD / ${rates.rub} RUB / ${rates.try} TRY`,
        );
        setTimeout(() => setResult(null), 8000);
      } catch (e) {
        setError(String(e));
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button
          onClick={handleRefresh}
          disabled={isPending}
          className="rounded-xl bg-brand px-5 py-2 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-50"
        >
          {isPending ? 'Обновляем…' : '↻ Обновить курсы с open.er-api.com'}
        </button>
        <span className="text-xs text-ink-500">USD / RUB / TRY (база: AZN)</span>
      </div>
      {result && (
        <p className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">{result}</p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}
    </div>
  );
}
