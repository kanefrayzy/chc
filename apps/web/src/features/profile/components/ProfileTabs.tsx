'use client';

import { useState } from 'react';
import { cn } from '@chcgreen/ui';

export interface ProfileTabDescriptor {
  id: string;
  label: string;
  content: React.ReactNode;
}

export interface ProfileTabsProps {
  tabs: ReadonlyArray<ProfileTabDescriptor>;
  initialTabId?: string;
}

export function ProfileTabs({ tabs, initialTabId }: ProfileTabsProps): JSX.Element {
  const [activeId, setActiveId] = useState<string>(
    initialTabId ?? tabs[0]?.id ?? '',
  );

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  return (
    <div>
      <div
        role="tablist"
        className="flex gap-1 overflow-x-auto border-b border-border"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              type="button"
              onClick={() => setActiveId(tab.id)}
              className={cn(
                'border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                isActive
                  ? 'border-brand text-text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="mt-6" role="tabpanel">
        {active?.content}
      </div>
    </div>
  );
}
