'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Card, CardBody, CardHeader, Button, Alert } from '@chcgreen/ui';
import {
  WithdrawMethodSelector,
  type WithdrawMethodOption,
} from './WithdrawMethodSelector';
import { DestinationFields } from './DestinationFields';
import { AmountInput, parseAmountToMinor } from '@/features/deposits/components/AmountInput';
import {
  withdrawalsApi,
  type WithdrawalMethod,
  type CreateWithdrawalDestination,
} from '@/lib/api/withdrawals';
import { ApiException } from '@/lib/api/client';

const DEFAULT_MIN_MINOR = 500n;
const DEFAULT_MAX_MINOR = 1_000_000n;

const EMPTY_DESTINATIONS: Record<WithdrawalMethod, CreateWithdrawalDestination> = {
  AUTO_BETRA_H2H: { kind: 'card', cardNumber: '' },
  AUTO_WESTWALLET: { kind: 'crypto', walletAddress: '', network: 'TRC20' },
  MANUAL_MODERATOR: { kind: 'manual', details: '' },
};

export interface WithdrawFormProps {
  balanceMinor: string;
  onSuccess?: () => void;
}

function validateDestination(d: CreateWithdrawalDestination): boolean {
  if (d.kind === 'card') return d.cardNumber.replace(/\s/g, '').length >= 8;
  if (d.kind === 'crypto') return d.walletAddress.length >= 20;
  return d.details.length >= 2;
}

export function WithdrawForm({ balanceMinor, onSuccess }: WithdrawFormProps): JSX.Element {
  const t = useTranslations('withdraw.form');
  const router = useRouter();
  const [method, setMethod] = useState<WithdrawalMethod>('AUTO_BETRA_H2H');
  const [destination, setDestination] = useState<CreateWithdrawalDestination>(
    EMPTY_DESTINATIONS.AUTO_BETRA_H2H,
  );
  const [amount, setAmount] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const options: readonly WithdrawMethodOption[] = [
    { id: 'AUTO_BETRA_H2H', label: 'Limpay', description: t('methodCard') },
    { id: 'AUTO_WESTWALLET', label: 'USDT (TRC20)', description: t('methodCrypto') },
    { id: 'MANUAL_MODERATOR', label: t('methodManualLabel'), description: t('methodManual') },
  ];

  const handleMethodChange = (next: WithdrawalMethod): void => {
    setMethod(next);
    setDestination(EMPTY_DESTINATIONS[next]);
  };

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
    if (minor > BigInt(balanceMinor)) {
      setErrorMessage(t('errors.insufficient'));
      return;
    }
    if (!validateDestination(destination)) {
      setErrorMessage(t('errors.invalidDestination'));
      return;
    }

    startTransition(async () => {
      try {
        await withdrawalsApi.create({
          method,
          amountMinor: minor.toString(),
          destination,
        });
        router.refresh();
        setAmount('');
        setDestination(EMPTY_DESTINATIONS[method]);
        if (onSuccess) onSuccess();
      } catch (err) {
        if (err instanceof ApiException) {
          setErrorMessage(err.message || t('errors.createFailed'));
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
            <div className="mb-2 text-sm font-medium text-text-secondary">{t('selectMethod')}</div>
            <WithdrawMethodSelector
              options={options}
              value={method}
              onChange={handleMethodChange}
              disabled={isPending}
            />
          </div>

          <DestinationFields
            method={method}
            destination={destination}
            onChange={setDestination}
            disabled={isPending}
            labels={{
              cardNumber: t('cardNumber'),
              cardHolder: t('cardHolder'),
              walletAddress: t('walletAddress'),
              manualDetails: t('manualDetails'),
            }}
          />

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
      </CardBody>
    </Card>
  );
}
