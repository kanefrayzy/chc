import { useTranslations } from 'next-intl';
import { Card } from '@chcgreen/ui';

export interface StatItem {
  value: string;
  /** ключ перевода в namespace 'stats' */
  labelKey: string;
}

export interface StatsGridProps {
  items: readonly StatItem[];
}

export function StatsGrid({ items }: StatsGridProps): JSX.Element {
  const t = useTranslations('stats');
  return (
    <section className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
      {items.map((item) => (
        <Card key={item.labelKey} padding="md">
          <div className="text-xl font-bold text-text-primary">{item.value}</div>
          <div className="mt-1 text-sm text-text-secondary">{t(item.labelKey)}</div>
        </Card>
      ))}
    </section>
  );
}
