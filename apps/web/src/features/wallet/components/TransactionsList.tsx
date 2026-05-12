'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Card, Spinner, Alert } from '@chcgreen/ui';
import { walletApi, type TransactionDto } from '@/lib/api/wallet';
import { ApiException } from '@/lib/api/client';
import { TransactionRow } from './TransactionRow';

export interface TransactionsListProps {
  locale: string;
  pageSize?: number;
}

export function TransactionsList({ locale, pageSize = 20 }: TransactionsListProps): JSX.Element {
  const t = useTranslations('wallet');
  const tTypes = useTranslations('wallet.tx');
  const [items, setItems] = useState<TransactionDto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const loadPage = useCallback(
    (after?: string | undefined) => {
      startTransition(async () => {
        try {
          const page = await walletApi.transactions({ limit: pageSize, cursor: after });
          setItems((prev) => (after ? [...prev, ...page.items] : page.items));
          setCursor(page.nextCursor);
          setError(null);
        } catch (e) {
          const msg = e instanceof ApiException ? e.message : t('errors.loadFailed');
          setError(msg);
        } finally {
          setInitialLoading(false);
        }
      });
    },
    [pageSize, t],
  );

  useEffect(() => {
    loadPage(undefined);
  }, [loadPage]);

  if (initialLoading) {
    return (
      <Card padding="lg" className="flex justify-center">
        <Spinner />
      </Card>
    );
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  if (items.length === 0) {
    return (
      <Card padding="lg">
        <p className="text-text-secondary">{t('empty')}</p>
      </Card>
    );
  }

  return (
    <Card padding="md">
      <div>
        {items.map((tx) => (
          <TransactionRow
            key={tx.id}
            tx={tx}
            locale={locale}
            typeLabel={tTypes(tx.type)}
          />
        ))}
      </div>
      {cursor && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="secondary"
            size="sm"
            loading={isPending}
            onClick={() => loadPage(cursor)}
          >
            {t('loadMore')}
          </Button>
        </div>
      )}
    </Card>
  );
}
