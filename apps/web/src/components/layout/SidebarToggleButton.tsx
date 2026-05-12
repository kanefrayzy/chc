'use client';

import { useUi } from './ui-context';

export function SidebarToggleButton(): JSX.Element {
  const { toggleSidebar } = useUi();
  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label="Toggle navigation"
      className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-bg-elevated text-text-secondary hover:text-text-primary"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden
      >
        <path d="M3 6h18M3 12h18M3 18h18" />
      </svg>
    </button>
  );
}
