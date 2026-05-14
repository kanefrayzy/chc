import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ShieldIcon, BoltIcon, HeadsetIcon, LockIcon } from '@/components/icons';

export interface FeatureItem {
  /** ключ namespace 'features' (например 'fair') */
  key: 'fair' | 'fast' | 'support' | 'ssl';
}

const ICONS: Record<FeatureItem['key'], ReactNode> = {
  fair: <ShieldIcon className="h-5 w-5" />,
  fast: <BoltIcon className="h-5 w-5" />,
  support: <HeadsetIcon className="h-5 w-5" />,
  ssl: <LockIcon className="h-5 w-5" />,
};

export interface FeaturesFooterProps {
  items: readonly FeatureItem[];
}

export function FeaturesFooter({ items }: FeaturesFooterProps): JSX.Element {
  const t = useTranslations('features');
  return (
    <footer className="mt-12 grid grid-cols-1 gap-3 border-t border-border pt-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
      {items.map((item) => (
        <div
          key={item.key}
          className="flex items-start gap-3 rounded-xl p-2 transition-colors hover:bg-bg-card/50"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand ring-1 ring-brand/20">
            {ICONS[item.key]}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-text-primary">{t(`${item.key}.title`)}</div>
            <div className="text-xs text-text-secondary">{t(`${item.key}.subtitle`)}</div>
          </div>
        </div>
      ))}
    </footer>
  );
}
