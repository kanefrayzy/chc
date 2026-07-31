'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardBody, Spinner, Alert } from '@chcgreen/ui';
import { RequisiteCard } from '@/features/wallet/components/RequisiteCard';
import { depositsApi, type DepositDto } from '@/lib/api/deposits';

export interface DepositsListProps {
  locale: string;
  pageSize?: number;
}

export function DepositsList({ locale, pageSize = 10 }: DepositsListProps): JSX.Element {
  const t = useTranslations('deposit.list');
  const [items, setItems] = useState<DepositDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadPage = (cursor?: string): void => {
    startTransition(async () => {
      try {
        const page = await depositsApi.list({ limit: pageSize, ...(cursor ? { cursor } : {}) });
        setItems((prev) => (cursor ? [...prev, ...page.items] : page.items));
        setNextCursor(page.nextCursor);
        setErrorMessage(null);
      } catch {
        setErrorMessage(t('errors.loadFailed'));
      } finally {
        setInitialLoading(false);
      }
    });
  };

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (initialLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (errorMessage) return <Alert variant="danger">{errorMessage}</Alert>;

  if (items.length === 0) {
    return (
      <Card variant="elevated">
        <CardBody className="text-center text-sm text-text-secondary">{t('empty')}</CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((d) => (
        <RequisiteCard key={d.id} deposit={d} locale={locale} />
      ))}
      {nextCursor ? (
        <div className="flex justify-center">
          <button
            type="button"
            disabled={isPending}
            onClick={() => loadPage(nextCursor)}
            className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:border-border-strong disabled:opacity-50"
          >
            {isPending ? t('loading') : t('loadMore')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
