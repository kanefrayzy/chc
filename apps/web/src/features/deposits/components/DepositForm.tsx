'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button, Alert, Spinner } from '@chcgreen/ui';
import { AmountInput, parseAmountToMinor } from './AmountInput';
import { PendingDepositCard } from './PendingDepositCard';
import { depositsApi, type DepositDto } from '@/lib/api/deposits';
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

  // H2H активный депозит — блокирует форму; WestWallet — не блокирует (статичный адрес)
  const [activeDeposit, setActiveDeposit] = useState<DepositDto | null | undefined>(undefined);
  const [walletDeposit, setWalletDeposit] = useState<DepositDto | null>(null);

  const checkActiveDeposit = useCallback((): void => {
    depositsApi
      .list({ limit: 10 })
      .then((res) => {
        // H2H (Betra) — блокирует форму (один активный счёт в раз время)
        const blocking = res.items.find(
          (d) =>
            d.provider !== 'WESTWALLET' &&
            (d.status === 'PENDING' || d.status === 'PROCESSING') &&
            (d.expiresAt === null || new Date(d.expiresAt) > new Date()),
        );
        // WestWallet — показываем отдельно, не блокируем
        const wallet = res.items.find(
          (d) =>
            d.provider === 'WESTWALLET' &&
            (d.status === 'PENDING' || d.status === 'PROCESSING'),
        );
        setActiveDeposit(blocking ?? null);
        setWalletDeposit(wallet ?? null);
      })
      .catch(() => {
        setActiveDeposit(null);
        setWalletDeposit(null);
      });
  }, []);

  useEffect(() => {
    checkActiveDeposit();
  }, [checkActiveDeposit]);

  useEffect(() => {
    if (activeDeposit !== null) return; // уже проверили или нашли активный
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
  }, [t, activeDeposit]);

  // Таймер дошёл до 0 → перезагружаем
  const handleExpire = useCallback((): void => {
    router.refresh();
    checkActiveDeposit();
  }, [router, checkActiveDeposit]);

  const selected = methods.find((m) => m.id === selectedId) ?? null;
  const isStaticWallet = selected?.provider === 'WESTWALLET';
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

    // WestWallet: сумма не требуется — зачисление по факту IPN
    let minor: bigint;
    if (isStaticWallet) {
      minor = 1n;
    } else {
      const parsed = parseAmountToMinor(amount);
      if (parsed === null) {
        setErrorMessage(t('errors.invalidAmount'));
        return;
      }
      if (parsed < minMinor || parsed > maxMinor) {
        setErrorMessage(t('errors.outOfRange'));
        return;
      }
      minor = parsed;
    }

    startTransition(async () => {
      try {
        const created = await depositsApi.create({
          paymentMethodId: selected.id,
          amountMinor: minor.toString(),
        });
        if (isStaticWallet) {
          setWalletDeposit(created);
        } else {
          setActiveDeposit(created);
        }
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

  // Загрузка статуса активного депозита
  if (activeDeposit === undefined) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  // Есть активный H2H депозит — показываем его карточку вместо формы
  if (activeDeposit !== null) {
    return (
      <div className="space-y-3">
        {walletDeposit && (
          <PendingDepositCard deposit={walletDeposit} locale={locale} />
        )}
        <p className="text-sm text-text-secondary">{t('activeDepositHint')}</p>
        <PendingDepositCard deposit={activeDeposit} locale={locale} onExpire={handleExpire} />
      </div>
    );
  }

  return (
    <div>
      {/* WestWallet: показываем адрес кошелька над формой, не блокируя её */}
      {walletDeposit && (
        <div className="mb-4">
          <PendingDepositCard deposit={walletDeposit} locale={locale} />
        </div>
      )}
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
                        'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition',
                        active
                          ? 'border-brand bg-brand/10 text-text-primary ring-1 ring-brand/30'
                          : 'border-border-subtle bg-bg-surface text-text-secondary hover:border-brand/50 hover:bg-brand/5',
                      ].join(' ')}
                    >
                      {m.iconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.iconUrl}
                          alt=""
                          className="h-7 w-7 shrink-0 rounded-lg object-contain bg-black/20"
                        />
                      ) : (
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand/20 text-[10px] font-bold text-brand">
                          {m.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium leading-tight">{m.name}</span>
                        <span className="block truncate text-[11px] text-text-muted leading-tight mt-0.5">
                          {m.description ?? m.currency}
                        </span>
                      </span>
                      {active && (
                        <span className="ml-auto h-4 w-4 shrink-0 rounded-full bg-brand flex items-center justify-center">
                          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-white">
                            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Поле суммы только для H2H (карта/банк). WestWallet — любую сумму принимает */}
          {!isStaticWallet && (
            <AmountInput
              label={t('amountLabel')}
              value={amount}
              onChange={setAmount}
              disabled={isPending || !selected}
              minMinor={minMinor}
              maxMinor={maxMinor}
            />
          )}

          {isStaticWallet && (
            <p className="text-sm text-text-secondary">
              Переведите любую сумму USDT на указанный адрес — зачисление произойдёт автоматически.
            </p>
          )}

          {errorMessage ? <Alert variant="danger">{errorMessage}</Alert> : null}

        <Button type="submit" variant="primary" disabled={isPending || !selected}>
          {isPending ? t('submitting') : t('submit')}
        </Button>
      </form>
      <p className="mt-4 text-xs text-text-muted">{t('hintLocale', { locale })}</p>
    </div>
  );
}
