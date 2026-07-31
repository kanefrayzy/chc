'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AmountField, parseAmountToMinor } from './AmountField';
import { MethodPicker } from './MethodPicker';
import { PanelMessage, PanelSkeleton, SubmitButton } from './panel-parts';
import { withdrawalsApi, type CreateWithdrawalDestination } from '@/lib/api/withdrawals';
import {
  paymentMethodsApi,
  type PublicPaymentMethod,
  type PaymentProviderId,
} from '@/lib/api/payment-methods';
import { getPublicSettings } from '@/lib/api/settings';
import { ApiException } from '@/lib/api/client';

const FALLBACK_MIN = 5_000n;
const FALLBACK_MAX = 1_000_000n;

function defaultDestination(p: PaymentProviderId): CreateWithdrawalDestination {
  if (p === 'WESTWALLET') return { kind: 'crypto', walletAddress: '', network: 'TRC20' };
  return { kind: 'card', cardNumber: '' };
}

function isDestinationValid(d: CreateWithdrawalDestination): boolean {
  if (d.kind === 'card') return d.cardNumber.replace(/\s/g, '').length >= 8;
  if (d.kind === 'crypto') return d.walletAddress.trim().length >= 20;
  return d.details.trim().length >= 2;
}

/** Поле ввода в стиле панели кошелька. */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-text-muted">{label}</span>
        {hint && <span className="text-[11px] text-text-muted">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

const inputClasses =
  'h-12 w-full rounded-xl border border-border bg-bg-base px-4 text-sm text-text-primary outline-none transition-all placeholder:text-text-muted/50 focus:border-accent-purple/60 focus:shadow-[0_0_0_4px_rgba(162,89,255,0.10)] disabled:opacity-60';

export interface WithdrawPanelProps {
  balanceMinor: string;
  onSuccess?: () => void;
}

export function WithdrawPanel({ balanceMinor, onSuccess }: WithdrawPanelProps): JSX.Element {
  const router = useRouter();
  const [methods, setMethods] = useState<PublicPaymentMethod[]>([]);
  const [methodsLoading, setMethodsLoading] = useState(true);
  const [methodsError, setMethodsError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [destination, setDestination] = useState<CreateWithdrawalDestination>({
    kind: 'card',
    cardNumber: '',
  });
  const [amount, setAmount] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [settingsMinMinor, setSettingsMinMinor] = useState<bigint>(FALLBACK_MIN);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getPublicSettings()
      .then((s) => {
        if (cancelled) return;
        try {
          setSettingsMinMinor(BigInt(s['withdrawal.min_amount_minor']));
        } catch {
          /* дефолт */
        }
      })
      .catch(() => {
        /* дефолт */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setMethodsLoading(true);
    paymentMethodsApi
      .list('WITHDRAWAL')
      .then((res) => {
        if (cancelled) return;
        setMethods(res.items);
        const first = res.items[0];
        if (first) {
          setSelectedId(first.id);
          setDestination(defaultDestination(first.provider));
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setMethodsError(e instanceof ApiException ? e.message : 'Не удалось загрузить способы вывода');
      })
      .finally(() => {
        if (!cancelled) setMethodsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = methods.find((m) => m.id === selectedId) ?? null;
  const balance = (() => {
    try {
      return BigInt(balanceMinor);
    } catch {
      return 0n;
    }
  })();

  const methodMin =
    selected && BigInt(selected.minAmountMinor) > 0n ? BigInt(selected.minAmountMinor) : settingsMinMinor;
  const minMinor = methodMin > settingsMinMinor ? methodMin : settingsMinMinor;
  const maxMinor =
    selected && BigInt(selected.maxAmountMinor) > 0n ? BigInt(selected.maxAmountMinor) : FALLBACK_MAX;
  const isCrypto = selected?.provider === 'WESTWALLET';

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setErrorMessage(null);
    if (!selected) {
      setErrorMessage('Выберите способ вывода');
      return;
    }
    const minor = parseAmountToMinor(amount);
    if (minor === null) {
      setErrorMessage('Введите корректную сумму');
      return;
    }
    if (minor < minMinor || minor > maxMinor) {
      setErrorMessage('Сумма вне допустимого диапазона');
      return;
    }
    if (minor > balance) {
      setErrorMessage('Недостаточно средств на балансе');
      return;
    }
    if (!isDestinationValid(destination)) {
      setErrorMessage(isCrypto ? 'Укажите корректный адрес кошелька' : 'Укажите корректный номер карты');
      return;
    }

    startTransition(async () => {
      try {
        await withdrawalsApi.create({
          paymentMethodId: selected.id,
          amountMinor: minor.toString(),
          destination,
        });
        setAmount('');
        setDestination(defaultDestination(selected.provider));
        toast.success('Заявка на вывод создана');
        router.refresh();
        if (onSuccess) onSuccess();
      } catch (err) {
        setErrorMessage(err instanceof ApiException ? err.message : 'Не удалось создать заявку');
      }
    });
  };

  if (methodsLoading) return <PanelSkeleton />;
  if (methodsError) return <PanelMessage variant="danger">{methodsError}</PanelMessage>;
  if (methods.length === 0)
    return <PanelMessage variant="warning">Способы вывода временно недоступны</PanelMessage>;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <MethodPicker
        methods={methods}
        selectedId={selectedId}
        onSelect={(m) => {
          setSelectedId(m.id);
          setDestination(defaultDestination(m.provider));
          setErrorMessage(null);
        }}
        disabled={isPending}
        label="Способ вывода"
        accent="purple"
      />

      {isCrypto ? (
        <Field label="Адрес кошелька" hint="USDT TRC20">
          <input
            className={inputClasses}
            value={destination.kind === 'crypto' ? destination.walletAddress : ''}
            disabled={isPending}
            spellCheck={false}
            onChange={(e) =>
              setDestination({ kind: 'crypto', walletAddress: e.target.value, network: 'TRC20' })
            }
            placeholder="T..."
          />
        </Field>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Номер карты">
            <input
              className={`${inputClasses} font-mono tracking-wide`}
              value={destination.kind === 'card' ? destination.cardNumber : ''}
              disabled={isPending}
              inputMode="numeric"
              maxLength={23}
              onChange={(e) =>
                setDestination((prev) => ({
                  kind: 'card',
                  cardNumber: e.target.value,
                  ...(prev.kind === 'card' && prev.cardHolder ? { cardHolder: prev.cardHolder } : {}),
                }))
              }
              placeholder="0000 0000 0000 0000"
            />
          </Field>
          <Field label="Владелец" hint="необязательно">
            <input
              className={`${inputClasses} uppercase`}
              value={destination.kind === 'card' ? (destination.cardHolder ?? '') : ''}
              disabled={isPending}
              onChange={(e) =>
                setDestination((prev) => ({
                  kind: 'card',
                  cardNumber: prev.kind === 'card' ? prev.cardNumber : '',
                  cardHolder: e.target.value,
                }))
              }
              placeholder="IVAN IVANOV"
            />
          </Field>
        </div>
      )}

      <AmountField
        label="Сумма вывода"
        value={amount}
        onChange={setAmount}
        disabled={isPending || !selected}
        minMinor={minMinor}
        maxMinor={maxMinor}
        presets={[]}
        maxAvailableMinor={balance < maxMinor ? balance : maxMinor}
        maxAvailableLabel="Вывести всё"
        accent="purple"
      />

      {errorMessage && <PanelMessage variant="danger">{errorMessage}</PanelMessage>}

      <div className="rounded-xl bg-bg-base/60 px-3.5 py-3">
        <p className="flex gap-2 text-xs text-text-secondary">
          <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent-purple" />
          <span>
            Заявка обрабатывается модератором. Средства резервируются сразу — до обработки заявку можно
            отменить в истории.
          </span>
        </p>
      </div>

      <SubmitButton loading={isPending} disabled={!selected} accent="purple">
        {isPending ? 'Отправляем…' : 'Вывести средства'}
      </SubmitButton>
    </form>
  );
}
