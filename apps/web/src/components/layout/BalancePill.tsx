'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@chcgreen/ui';
import { walletApi } from '@/lib/api/wallet';
import { formatMinorAmount } from '@/lib/format/money';
import { useUi } from './ui-context';
import { getRealtimeSocket } from '@/lib/realtime/socket';

export interface BalancePillProps {
  locale: 'ru' | 'az' | 'en';
  /** initial balance (минор) — берётся из SSR, чтобы не было прыжка */
  initialBalanceMinor: string | null;
  depositHref: string;
  withdrawHref: string;
}

export function BalancePill({
  locale,
  initialBalanceMinor,
}: BalancePillProps): JSX.Element {
  const t = useTranslations('topbar');
  const { balanceVersion, openDeposit, openWithdraw } = useUi();
  const [balance, setBalance] = useState<string | null>(initialBalanceMinor);
  const [loading, setLoading] = useState(false);

  // refetch on focus + balanceVersion + roulette round completion
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

    const onFocus = (): void => {
      void refetch();
    };
    window.addEventListener('focus', onFocus);

    const socket = getRealtimeSocket();
    const onRound = (r: { status: string }): void => {
      if (r.status === 'COMPLETED') void refetch();
    };
    socket.on('roulette:round', onRound);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      socket.off('roulette:round', onRound);
    };
  }, []);

  useEffect(() => {
    if (balanceVersion === 0) return;
    let cancelled = false;
    walletApi
      .balance()
      .then((r) => {
        if (!cancelled) setBalance(r.balanceMinor);
      })
      .catch(() => {
        /* silent */
      });
    return () => {
      cancelled = true;
    };
  }, [balanceVersion]);

  const display =
    balance != null
      ? formatMinorAmount(balance, { locale, showPositiveSign: false, withCurrency: false })
      : '—';

  return (
    <div className="flex items-center gap-1 rounded-xl border border-border bg-bg-elevated p-1 pl-3">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          {t('balance')}
        </span>
        <span
          className={cn(
            'font-mono text-sm font-semibold text-text-primary tabular-nums',
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
        className="ml-2 inline-flex h-8 items-center gap-1 rounded-lg bg-brand px-3 text-xs font-bold text-bg-base shadow-glow hover:bg-brand-dim"
      >
        + {t('deposit')}
      </button>
      <button
        type="button"
        onClick={openWithdraw}
        className="hidden sm:inline-flex h-8 items-center rounded-lg border border-border bg-bg-card px-3 text-xs font-medium text-text-secondary hover:bg-bg-card-hover hover:text-text-primary"
      >
        {t('withdraw')}
      </button>
    </div>
  );
}
