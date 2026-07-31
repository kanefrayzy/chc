'use client';

import { useCallback, useEffect, useState } from 'react';
import { useUi } from './ui-context';
import { WalletModal, type WalletTab } from '@/features/wallet/components/WalletModal';
import { walletApi } from '@/lib/api/wallet';

export interface WalletModalHostProps {
  locale: string;
  initialBalanceMinor: string | null;
}

/**
 * Связывает единое окно кошелька с ui-контекстом: открытие пополнения
 * и вывода переключает вкладки одного и того же окна.
 */
export function WalletModalHost({ locale, initialBalanceMinor }: WalletModalHostProps): JSX.Element {
  const {
    depositModalOpen,
    withdrawModalOpen,
    closeDeposit,
    closeWithdraw,
    openDeposit,
    openWithdraw,
    refreshBalance,
    balanceVersion,
  } = useUi();

  const [balanceMinor, setBalanceMinor] = useState<string | null>(initialBalanceMinor);
  const open = depositModalOpen || withdrawModalOpen;
  const tab: WalletTab = withdrawModalOpen ? 'withdraw' : 'deposit';

  // Актуализируем баланс при открытии и после каждого события пополнения
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    walletApi
      .balance()
      .then((res) => {
        if (!cancelled) setBalanceMinor(res.balanceMinor);
      })
      .catch(() => {
        /* оставляем прежнее значение */
      });
    return () => {
      cancelled = true;
    };
  }, [open, balanceVersion]);

  const handleClose = useCallback((): void => {
    closeDeposit();
    closeWithdraw();
  }, [closeDeposit, closeWithdraw]);

  const handleTabChange = useCallback(
    (next: WalletTab): void => {
      if (next === 'deposit') {
        closeWithdraw();
        openDeposit();
      } else {
        closeDeposit();
        openWithdraw();
      }
    },
    [closeDeposit, closeWithdraw, openDeposit, openWithdraw],
  );

  return (
    <WalletModal
      open={open}
      tab={tab}
      onTabChange={handleTabChange}
      onClose={handleClose}
      locale={locale}
      balanceMinor={balanceMinor}
      onBalanceRefresh={refreshBalance}
    />
  );
}
