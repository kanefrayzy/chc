'use client';

import { useTranslations } from 'next-intl';
import { Card, CardBody, CardHeader, Badge } from '@chcgreen/ui';
import type { DepositDto } from '@/lib/api/deposits';
import { formatMinorAmount } from '@/lib/format/money';

export interface PendingDepositCardProps {
  deposit: DepositDto;
  locale: string;
}

const STATUS_VARIANT: Record<DepositDto['status'], 'warning' | 'info' | 'success' | 'danger'> = {
  PENDING: 'warning',
  PROCESSING: 'info',
  COMPLETED: 'success',
  FAILED: 'danger',
  EXPIRED: 'danger',
};

export function PendingDepositCard({ deposit, locale }: PendingDepositCardProps): JSX.Element {
  const t = useTranslations('deposit.card');

  return (
    <Card variant="elevated">
      <CardHeader className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-text-muted">
            {t('provider')}: {deposit.provider === 'BETRA_H2H' ? 'Limpay' : 'WestWallet'}
          </div>
          <div className="text-lg font-semibold text-text-primary">
            {formatMinorAmount(deposit.amountMinor, { locale: locale as 'ru' | 'az' })}
          </div>
        </div>
        <Badge variant={STATUS_VARIANT[deposit.status]}>{t(`status.${deposit.status}`)}</Badge>
      </CardHeader>
      <CardBody className="space-y-2 text-sm text-text-secondary">
        {deposit.paymentUrl ? (
          <a
            href={deposit.paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-bg-base transition hover:bg-brand-dim"
          >
            {t('payNow')}
          </a>
        ) : null}
        {deposit.externalAddress ? (
          <div>
            <div className="text-xs text-text-muted">{t('address')}</div>
            <code className="block break-all rounded bg-bg-elevated px-2 py-1 text-xs text-text-primary">
              {deposit.externalAddress}
            </code>
          </div>
        ) : null}
        {deposit.originalAmount && deposit.originalCurrency ? (
          <div className="text-xs text-text-muted">
            {t('expectedAmount')}: {deposit.originalAmount} {deposit.originalCurrency}
          </div>
        ) : null}
        <div className="text-xs text-text-muted" suppressHydrationWarning>
          {new Date(deposit.createdAt).toLocaleString(locale === 'az' ? 'az-AZ' : 'ru-RU')}
        </div>
      </CardBody>
    </Card>
  );
}
