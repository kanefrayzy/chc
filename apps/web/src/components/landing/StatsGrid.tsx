import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { UsersIcon, GamepadIcon, WalletIcon, TrophyIcon } from '@/components/icons';

export interface StatItem {
  value: string;
  labelKey: string;
  iconKey: 'players' | 'games' | 'wallet' | 'trophy';
  accent: 'brand' | 'info' | 'purple' | 'warning';
}

export interface StatsGridProps {
  items: readonly StatItem[];
}

const ICONS: Record<StatItem['iconKey'], ReactNode> = {
  players: <UsersIcon className="h-5 w-5" />,
  games: <GamepadIcon className="h-5 w-5" />,
  wallet: <WalletIcon className="h-5 w-5" />,
  trophy: <TrophyIcon className="h-5 w-5" />,
};

const ACCENTS: Record<StatItem['accent'], string> = {
  brand: 'bg-brand/10 text-brand ring-1 ring-brand/20',
  info: 'bg-info/10 text-info ring-1 ring-info/20',
  purple: 'bg-accent-purple/10 text-accent-purple ring-1 ring-accent-purple/20',
  warning: 'bg-warning/10 text-warning ring-1 ring-warning/20',
};

export function StatsGrid({ items }: StatsGridProps): JSX.Element {
  const t = useTranslations('stats');
  return (
    <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-label={t('label')}>
      {items.map((item) => (
        <div
          key={item.labelKey}
          className="group relative overflow-hidden rounded-2xl border border-border bg-bg-card p-4 transition-colors hover:border-border-strong sm:p-5"
        >
          <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${ACCENTS[item.accent]}`}>
            {ICONS[item.iconKey]}
          </div>
          <div className="font-mono text-lg font-bold tabular-nums text-text-primary sm:text-xl">
            {item.value}
          </div>
          <div className="mt-1 text-xs text-text-secondary sm:text-sm">{t(item.labelKey)}</div>
        </div>
      ))}
    </section>
  );
}
