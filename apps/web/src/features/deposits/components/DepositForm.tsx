'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Card, CardBody, CardHeader, Button, Alert } from '@chcgreen/ui';
import { ProviderSelector, type ProviderOption } from './ProviderSelector';
import { AmountInput, parseAmountToMinor } from './AmountInput';
import { depositsApi, type PaymentProviderId } from '@/lib/api/deposits';
import { ApiException } from '@/lib/api/client';

const DEFAULT_MIN_MINOR = 100n; // 1 AZN
const DEFAULT_MAX_MINOR = 1_000_000n; // 10 000 AZN

export interface DepositFormProps {
  locale: string;
  onSuccess?: () => void;
}

export function DepositForm({ locale, onSuccess }: DepositFormProps): JSX.Element {
  const t = useTranslations('deposit.form');
  const router = useRouter();
  const [provider, setProvider] = useState<PaymentProviderId>('BETRA_H2H');
  const [amount, setAmount] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const options: readonly ProviderOption[] = [
    { id: 'BETRA_H2H', label: 'Limpay', description: t('providerLimpay') },
    { id: 'WESTWALLET', label: 'WestWallet (USDT)', description: t('providerWest') },
  ];

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setErrorMessage(null);
    const minor = parseAmountToMinor(amount);
    if (minor === null) {
      setErrorMessage(t('errors.invalidAmount'));
      return;
    }
    if (minor < DEFAULT_MIN_MINOR || minor > DEFAULT_MAX_MINOR) {
      setErrorMessage(t('errors.outOfRange'));
      return;
    }

    startTransition(async () => {
      try {
        await depositsApi.create({ provider, amountMinor: minor.toString() });
        router.refresh();
        setAmount('');
        if (onSuccess) onSuccess();
      } catch (e) {
        if (e instanceof ApiException) {
          setErrorMessage(e.message || t('errors.createFailed'));
        } else {
          setErrorMessage(t('errors.createFailed'));
        }
      }
    });
  };

  return (
    <Card variant="elevated" padding="lg">
      <CardHeader>
        <h2 className="text-xl font-semibold text-text-primary">{t('title')}</h2>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <div className="mb-2 text-sm font-medium text-text-secondary">{t('selectProvider')}</div>
            <ProviderSelector
              options={options}
              value={provider}
              onChange={setProvider}
              disabled={isPending}
            />
          </div>

          <AmountInput
            label={t('amountLabel')}
            value={amount}
            onChange={setAmount}
            disabled={isPending}
            minMinor={DEFAULT_MIN_MINOR}
            maxMinor={DEFAULT_MAX_MINOR}
          />

          {errorMessage ? <Alert variant="danger">{errorMessage}</Alert> : null}

          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? t('submitting') : t('submit')}
          </Button>
        </form>
        <p className="mt-4 text-xs text-text-muted">{t('hintLocale', { locale })}</p>
      </CardBody>
    </Card>
  );
}
