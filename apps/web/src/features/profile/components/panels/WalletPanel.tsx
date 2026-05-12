'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Spinner, Alert } from '@chcgreen/ui';
import { walletApi, type WalletBalanceDto } from '@/lib/api/wallet';
import { ApiException } from '@/lib/api/client';
import { BalanceCard } from '@/features/wallet/components/BalanceCard';
import { TransactionsList } from '@/features/wallet/components/TransactionsList';

export interface WalletPanelProps {
  locale: string;
}

export function WalletPanel({ locale }: WalletPanelProps): JSX.Element {
  const t = useTranslations('wallet');
  const [balance, setBalance] = useState<WalletBalanceDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        const b = await walletApi.balance();
        setBalance(b);
      } catch (e) {
        setError(e instanceof ApiException ? e.message : t('errors.loadFailed'));
      }
    });
  }, [t]);

  return (
    <div className="space-y-6">
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {balance ? (
        <BalanceCard
          balanceMinor={balance.balanceMinor}
          totalWageredMinor={balance.totalWageredMinor}
          title={t('balance.title')}
          wageredLabel={t('balance.wagered')}
        />
      ) : (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}
      <h3 className="text-lg font-semibold text-text-primary">{t('history.title')}</h3>
      <TransactionsList locale={locale} />
    </div>
  );
}
