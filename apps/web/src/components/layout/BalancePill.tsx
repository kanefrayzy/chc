'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@chcgreen/ui';
import { walletApi } from '@/lib/api/wallet';
import { formatMinorAmount } from '@/lib/format/money';
import { useUi } from './ui-context';
import { PlusIcon, ArrowUpIcon } from '@/components/icons';

export interface BalancePillProps {
  locale: 'ru' | 'az' | 'en';
  /** initial balance (минор) — берётся из SSR, чтобы не было прыжка */
  initialBalanceMinor: string | null;
}

export function BalancePill({
  locale,
  initialBalanceMinor,
}: BalancePillProps): JSX.Element {
  const t = useTranslations('topbar');
  const { balanceVersion, openDeposit, openWithdraw } = useUi();
  const [balance, setBalance] = useState<string | null>(initialBalanceMinor);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const refetch = async (): Promise<void> => {
      setLoading(true);
      try {
        const res = await walletApi.balance();
        if (!cancelled) setBalance(res.balanceMinor);
      } catch {
        /* silent */
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const onFocus = (): void => { void refetch(); };
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  useEffect(() => {
    if (balanceVersion === 0) return;
    let cancelled = false;
    walletApi
      .balance()
      .then((r) => { if (!cancelled) setBalance(r.balanceMinor); })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, [balanceVersion]);

  const display =
    balance != null
      ? formatMinorAmount(balance, { locale, showPositiveSign: false, withCurrency: false })
      : '—';

  return (
    <div className="flex items-center gap-1 rounded-xl border border-border bg-bg-elevated p-1 pl-3">
      <div className="flex items-baseline gap-1.5">
        <span className="hidden md:inline text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          {t('balance')}
        </span>
        <span
          className={cn(
            'font-mono text-sm font-semibold tabular-nums text-text-primary',
            loading && 'opacity-60',
          )}
        >
          {display}
        </span>
        <span className="text-[10px] font-semibold text-brand">AZN</span>
      </div>
      <button
        type="button"
        onClick={openDeposit}
        aria-label={t('deposit')}
        className="ml-2 inline-flex h-8 items-center gap-1 rounded-lg bg-brand px-2 sm:px-3 text-xs font-bold text-bg-base shadow-glow transition-all hover:bg-brand-dim active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        <PlusIcon className="h-4 w-4" />
        <span className="hidden sm:inline">{t('deposit')}</span>
      </button>
      <button
        type="button"
        onClick={openWithdraw}
        aria-label={t('withdraw')}
        className="hidden sm:inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-bg-card px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        <ArrowUpIcon className="h-3.5 w-3.5" />
        <span>{t('withdraw')}</span>
      </button>
    </div>
  );
}
