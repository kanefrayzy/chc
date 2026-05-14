'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button, Alert } from '@chcgreen/ui';
import { AmountInput, parseAmountToMinor } from './AmountInput';
import { depositsApi } from '@/lib/api/deposits';
import { paymentMethodsApi, type PublicPaymentMethod } from '@/lib/api/payment-methods';
import { ApiException } from '@/lib/api/client';

const FALLBACK_MIN = 100n;
const FALLBACK_MAX = 1_000_000n;

export interface DepositFormProps {
  locale: string;
  onSuccess?: () => void;
}

export function DepositForm({ locale, onSuccess }: DepositFormProps): JSX.Element {
  const t = useTranslations('deposit.form');
  const router = useRouter();
  const [methods, setMethods] = useState<PublicPaymentMethod[]>([]);
  const [methodsLoading, setMethodsLoading] = useState(true);
  const [methodsError, setMethodsError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    setMethodsLoading(true);
    paymentMethodsApi
      .list('DEPOSIT')
      .then((res) => {
        if (cancelled) return;
        setMethods(res.items);
        if (res.items.length > 0) setSelectedId(res.items[0]!.id);
      })
      .catch((e) => {
        if (cancelled) return;
        setMethodsError(e instanceof ApiException ? e.message : t('errors.loadMethods'));
      })
      .finally(() => {
        if (!cancelled) setMethodsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const selected = methods.find((m) => m.id === selectedId) ?? null;
  const minMinor =
    selected && BigInt(selected.minAmountMinor) > 0n
      ? BigInt(selected.minAmountMinor)
      : FALLBACK_MIN;
  const maxMinor =
    selected && BigInt(selected.maxAmountMinor) > 0n
      ? BigInt(selected.maxAmountMinor)
      : FALLBACK_MAX;

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setErrorMessage(null);
    if (!selected) {
      setErrorMessage(t('errors.selectMethod'));
      return;
    }
    const minor = parseAmountToMinor(amount);
    if (minor === null) {
      setErrorMessage(t('errors.invalidAmount'));
      return;
    }
    if (minor < minMinor || minor > maxMinor) {
      setErrorMessage(t('errors.outOfRange'));
      return;
    }

    startTransition(async () => {
      try {
        await depositsApi.create({
          paymentMethodId: selected.id,
          amountMinor: minor.toString(),
        });
        router.refresh();
        setAmount('');
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
    <div>
      <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <div className="mb-2 text-sm font-medium text-text-secondary">
              {t('selectProvider')}
            </div>
            {methodsLoading ? (
              <div className="text-sm text-text-muted">{t('loading')}</div>
            ) : methodsError ? (
              <Alert variant="danger">{methodsError}</Alert>
            ) : methods.length === 0 ? (
              <Alert variant="warning">{t('errors.noMethods')}</Alert>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {methods.map((m) => {
                  const active = m.id === selectedId;
                  return (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => setSelectedId(m.id)}
                      disabled={isPending}
                      className={[
                        'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition',
                        active
                          ? 'border-brand bg-brand/10 text-text-primary'
                          : 'border-border-default bg-bg-surface text-text-secondary hover:border-border-strong',
                      ].join(' ')}
                    >
                      {m.iconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.iconUrl}
                          alt=""
                          className="h-8 w-8 rounded-md object-contain bg-black/20"
                        />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand/20 text-xs font-semibold text-brand">
                          {m.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{m.name}</span>
                        <span className="block truncate text-xs text-text-muted">
                          {m.description ?? m.currency}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <AmountInput
            label={t('amountLabel')}
            value={amount}
            onChange={setAmount}
            disabled={isPending || !selected}
            minMinor={minMinor}
            maxMinor={maxMinor}
          />

          {errorMessage ? <Alert variant="danger">{errorMessage}</Alert> : null}

        <Button type="submit" variant="primary" disabled={isPending || !selected}>
          {isPending ? t('submitting') : t('submit')}
        </Button>
      </form>
      <p className="mt-4 text-xs text-text-muted">{t('hintLocale', { locale })}</p>
    </div>
  );
}
