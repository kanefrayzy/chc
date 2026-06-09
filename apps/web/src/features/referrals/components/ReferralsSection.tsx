'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Spinner } from '@chcgreen/ui';
import { referralsApi, type ReferralUserDto } from '@/lib/api/referrals';
import { ReferralsList } from './ReferralsList';

export interface ReferralsSectionProps {
  locale: string;
  initialItems: ReferralUserDto[];
  initialCursor: string | null;
}

export function ReferralsSection({
  locale,
  initialItems,
  initialCursor,
}: ReferralsSectionProps): JSX.Element {
  const t = useTranslations('referrals.list');
  const [items, setItems] = useState<ReferralUserDto[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const page = await referralsApi.list({ cursor, limit: 20 });
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [cursor, loading]);

  useEffect(() => {
    setItems(initialItems);
    setCursor(initialCursor);
  }, [initialItems, initialCursor]);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-text-primary">{t('title')}</h2>
      <ReferralsList items={items} locale={locale} />
      {cursor && (
        <div className="flex justify-center">
          <Button variant="secondary" type="button" onClick={loadMore} disabled={loading}>
            {loading ? <Spinner size="sm" /> : t('loadMore')}
          </Button>
        </div>
      )}
    </section>
  );
}
