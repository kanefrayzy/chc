'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

interface UiState {
  sidebarOpen: boolean;
  authModalOpen: boolean;
  authModalTab: 'login' | 'register';
  toggleSidebar: () => void;
  closeSidebar: () => void;
  openAuth: (tab?: 'login' | 'register') => void;
  closeAuth: () => void;
  /** Триггер «перезагрузить баланс» — на него подписаны BalancePill и др. */
  refreshBalance: () => void;
  balanceVersion: number;
}

const UiContext = createContext<UiState | null>(null);

export function UiProvider({ children }: { children: ReactNode }): JSX.Element {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register'>('login');
  const [balanceVersion, setBalanceVersion] = useState(0);

  const toggleSidebar = useCallback((): void => {
    setSidebarOpen((v) => !v);
  }, []);
  const closeSidebar = useCallback((): void => setSidebarOpen(false), []);
  const openAuth = useCallback((tab: 'login' | 'register' = 'login'): void => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  }, []);
  const closeAuth = useCallback((): void => setAuthModalOpen(false), []);
  const refreshBalance = useCallback((): void => {
    setBalanceVersion((v) => v + 1);
  }, []);

  // Закрываем сайдбар при ресайзе на десктоп
  useEffect(() => {
    const onResize = (): void => {
      if (window.innerWidth >= 1024) setSidebarOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <UiContext.Provider
      value={{
        sidebarOpen,
        authModalOpen,
        authModalTab,
        toggleSidebar,
        closeSidebar,
        openAuth,
        closeAuth,
        refreshBalance,
        balanceVersion,
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
