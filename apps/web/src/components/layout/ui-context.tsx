'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

interface UiState {
  sidebarOpen: boolean;
  authModalOpen: boolean;
  authModalTab: 'login' | 'register';
  depositModalOpen: boolean;
  withdrawModalOpen: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  openAuth: (tab?: 'login' | 'register') => void;
  closeAuth: () => void;
  openDeposit: () => void;
  closeDeposit: () => void;
  openWithdraw: () => void;
  closeWithdraw: () => void;
  /** Триггер «перезагрузить баланс» — на него подписаны BalancePill и др. */
  refreshBalance: () => void;
  balanceVersion: number;
}

const UiContext = createContext<UiState | null>(null);

export function UiProvider({ children }: { children: ReactNode }): JSX.Element {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register'>('login');
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [balanceVersion, setBalanceVersion] = useState(0);

  const toggleSidebar = useCallback((): void => { setSidebarOpen((v) => !v); }, []);
  const closeSidebar = useCallback((): void => setSidebarOpen(false), []);
  const openAuth = useCallback((tab: 'login' | 'register' = 'login'): void => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  }, []);
  const closeAuth = useCallback((): void => setAuthModalOpen(false), []);
  const openDeposit = useCallback((): void => setDepositModalOpen(true), []);
  const closeDeposit = useCallback((): void => setDepositModalOpen(false), []);
  const openWithdraw = useCallback((): void => setWithdrawModalOpen(true), []);
  const closeWithdraw = useCallback((): void => setWithdrawModalOpen(false), []);
  const refreshBalance = useCallback((): void => { setBalanceVersion((v) => v + 1); }, []);

  useEffect(() => {
    const onResize = (): void => { if (window.innerWidth >= 1024) setSidebarOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <UiContext.Provider
      value={{
        sidebarOpen, authModalOpen, authModalTab,
        depositModalOpen, withdrawModalOpen,
        toggleSidebar, closeSidebar,
        openAuth, closeAuth,
        openDeposit, closeDeposit,
        openWithdraw, closeWithdraw,
        refreshBalance, balanceVersion,
      }}
    >
      {children}
    </UiContext.Provider>
  );
}

export function useUi(): UiState {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi must be used within <UiProvider>');
  return ctx;
}
