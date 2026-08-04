'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardBody, CardHeader, Badge, Button } from '@chcgreen/ui';
import type { WithdrawalDto } from '@/lib/api/withdrawals';
import { withdrawalsApi } from '@/lib/api/withdrawals';
import { formatMinorAmount } from '@/lib/format/money';

const STATUS_VARIANT: Record<WithdrawalDto['status'], 'warning' | 'info' | 'success' | 'danger' | 'neutral'> = {
  PENDING: 'warning',
  PROCESSING: 'info',
  COMPLETED: 'success',
  REJECTED: 'danger',
  FAILED: 'danger',
  CANCELLED: 'neutral',
};

/**
 * Запасные названия, если у заявки не сохранился платёжный метод.
 * Игроку показываем платёжку, а не агрегатора, через который она проходит.
 */
const METHOD_LABEL: Record<WithdrawalDto['method'], string> = {
  AUTO_BETATRANSFER: 'Карта',
  AUTO_WESTWALLET: 'USDT TRC20',
  MANUAL_MODERATOR: 'Вручную',
};

export interface WithdrawalCardProps {
  withdrawal: WithdrawalDto;
  locale: string;
}

export function WithdrawalCard({ withdrawal, locale }: WithdrawalCardProps): JSX.Element {
  const t = useTranslations('withdraw.card');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleCancel = (): void => {
    startTransition(async () => {
      try {
        await withdrawalsApi.cancel(withdrawal.id);
        router.refresh();
      } catch {
        /* проигнорировано: ошибка отобразится при следующем refresh */
      }
    });
  };

  return (
    <Card variant="elevated">
      <CardHeader className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-text-muted">
            {t('method')}: {withdrawal.methodName ?? METHOD_LABEL[withdrawal.method]}
          </div>
          <div className="text-lg font-semibold text-text-primary">
            {formatMinorAmount(withdrawal.amountMinor, { locale: locale as 'ru' | 'az' })}
          </div>
        </div>
        <Badge variant={STATUS_VARIANT[withdrawal.status]}>{t(`status.${withdrawal.status}`)}</Badge>
      </CardHeader>
      <CardBody className="space-y-2 text-sm text-text-secondary">
        <div>
          <div className="text-xs text-text-muted">{t('destination')}</div>
          <code className="block break-all rounded bg-bg-elevated px-2 py-1 text-xs text-text-primary">
            {withdrawal.destination.display}
            {withdrawal.destination.network ? ` · ${withdrawal.destination.network}` : ''}
          </code>
        </div>
        {withdrawal.reason ? (
          <div>
            <div className="text-xs text-text-muted">{t('reason')}</div>
            <div className="text-xs text-danger">{withdrawal.reason}</div>
          </div>
        ) : null}
        <div className="text-xs text-text-muted" suppressHydrationWarning>
          {new Date(withdrawal.createdAt).toLocaleString(locale === 'az' ? 'az-AZ' : 'ru-RU')}
        </div>
        {withdrawal.status === 'PENDING' ? (
          <Button type="button" variant="ghost" onClick={handleCancel} disabled={isPending}>
            {isPending ? t('cancelling') : t('cancel')}
          </Button>
        ) : null}
      </CardBody>
    </Card>
  );
}
