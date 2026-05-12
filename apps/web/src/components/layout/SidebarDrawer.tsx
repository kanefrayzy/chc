'use client';

import { useEffect, type ReactNode } from 'react';
import { useUi } from './ui-context';

export interface SidebarDrawerProps {
  children: ReactNode;
}

export function SidebarDrawer({ children }: SidebarDrawerProps): JSX.Element | null {
  const { sidebarOpen, closeSidebar } = useUi();

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeSidebar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sidebarOpen, closeSidebar]);

  return (
    <div
      className={`lg:hidden fixed inset-0 z-40 transition-opacity ${
        sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
      aria-hidden={!sidebarOpen}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closeSidebar}
      />
      <aside
        className={`absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border bg-bg-elevated px-3 py-5 transition-transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {children}
      </aside>
    </div>
  );
}
