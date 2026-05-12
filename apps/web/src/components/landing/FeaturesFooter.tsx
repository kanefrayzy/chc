import { useTranslations } from 'next-intl';

export interface FeatureItem {
  /** ключ namespace 'features' (например 'fair') */
  key: string;
}

export interface FeaturesFooterProps {
  items: readonly FeatureItem[];
}

export function FeaturesFooter({ items }: FeaturesFooterProps): JSX.Element {
  const t = useTranslations('features');
  return (
    <footer className="mt-16 grid grid-cols-1 gap-4 border-t border-border pt-6 text-sm text-text-secondary sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.key} className="flex flex-col">
          <span className="font-semibold text-text-primary">{t(`${item.key}.title`)}</span>
          <span>{t(`${item.key}.subtitle`)}</span>
        </div>
      ))}
    </footer>
  );
}
