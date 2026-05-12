'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardBody, CardHeader, Button, Alert, FormField, Input } from '@chcgreen/ui';
import { AmountInput, parseAmountToMinor } from '@/features/deposits/components/AmountInput';
import { codePurchasesApi } from '@/lib/api/code-purchases';
import { ApiException } from '@/lib/api/client';

const DEFAULT_MIN_MINOR = 100n;
const DEFAULT_MAX_MINOR = 1_000_000n;

export interface CodePurchaseFormProps {
  locale: string;
  balanceMinor: string;
}

export function CodePurchaseForm({ locale, balanceMinor }: CodePurchaseFormProps): JSX.Element {
  const t = useTranslations('codePurchase.form');
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setErrorMessage(null);
    const minor = parseAmountToMinor(amount);
    if (minor === null) return setErrorMessage(t('errors.invalidAmount'));
    if (minor < DEFAULT_MIN_MINOR || minor > DEFAULT_MAX_MINOR) {
      return setErrorMessage(t('errors.outOfRange'));
    }
    if (minor > BigInt(balanceMinor)) return setErrorMessage(t('errors.insufficient'));

    startTransition(async () => {
      try {
        const res = await codePurchasesApi.create({
          amountMinor: minor.toString(),
          ...(comment.trim() ? { comment: comment.trim() } : {}),
        });
        setAmount('');
        setComment('');
        const prefix = locale === 'ru' ? '' : `/${locale}`;
        router.push(res.ticketId ? `${prefix}/chat?ticket=${res.ticketId}` : `${prefix}/chat`);
      } catch (err) {
        if (err instanceof ApiException) setErrorMessage(err.message || t('errors.createFailed'));
        else setErrorMessage(t('errors.createFailed'));
      }
    });
  };

  return (
    <Card variant="elevated" padding="lg">
      <CardHeader>
        <h2 className="text-xl font-semibold text-text-primary">{t('title')}</h2>
        <p className="mt-1 text-sm text-text-secondary">{t('description')}</p>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-5">
          <AmountInput
            label={t('amountLabel')}
            value={amount}
            onChange={setAmount}
            disabled={isPending}
            minMinor={DEFAULT_MIN_MINOR}
            maxMinor={DEFAULT_MAX_MINOR}
          />
          <FormField label={t('commentLabel')} hint={t('commentHint')}>
            {(id) => (
              <Input
                id={id}
                value={comment}
                disabled={isPending}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('commentPlaceholder')}
              />
            )}
          </FormField>
          {errorMessage ? <Alert variant="danger">{errorMessage}</Alert> : null}
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? t('submitting') : t('submit')}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
