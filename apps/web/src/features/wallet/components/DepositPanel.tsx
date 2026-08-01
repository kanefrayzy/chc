'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AmountField, parseAmountToMinor } from './AmountField';
import { MethodPicker } from './MethodPicker';
import { RequisiteCard } from './RequisiteCard';
import { PanelMessage, PanelSkeleton, SubmitButton } from './panel-parts';
import { depositsApi, type DepositDto } from '@/lib/api/deposits';
import { paymentMethodsApi, type PublicPaymentMethod } from '@/lib/api/payment-methods';
import { ApiException } from '@/lib/api/client';
import { getRealtimeSocket } from '@/lib/realtime/socket';

const FALLBACK_MIN = 100n;
const FALLBACK_MAX = 1_000_000n;

export interface DepositPanelProps {
  locale: string;
  onSuccess?: () => void;
}

export function DepositPanel({ locale, onSuccess }: DepositPanelProps): JSX.Element {
  const router = useRouter();
  const [methods, setMethods] = useState<PublicPaymentMethod[]>([]);
  const [methodsLoading, setMethodsLoading] = useState(true);
  const [methodsError, setMethodsError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  /** Активный счёт (фиат) блокирует создание нового; крипто-адрес — нет. */
  const [activeDeposit, setActiveDeposit] = useState<DepositDto | null | undefined>(undefined);
  const [walletDeposit, setWalletDeposit] = useState<DepositDto | null>(null);
  const [walletCreating, setWalletCreating] = useState(false);

  const loadActiveDeposit = useCallback((): void => {
    depositsApi
      .list({ limit: 10 })
      .then((res) => {
        const blocking = res.items.find(
          (d) =>
            d.provider !== 'WESTWALLET' &&
            (d.status === 'PENDING' || d.status === 'PROCESSING') &&
            (d.expiresAt === null || new Date(d.expiresAt) > new Date()),
        );
        setActiveDeposit(blocking ?? null);
      })
      .catch(() => setActiveDeposit(null));
  }, []);

  useEffect(loadActiveDeposit, [loadActiveDeposit]);

  // Зачисление приходит по WebSocket — закрываем карточку счёта
  useEffect(() => {
    const socket = getRealtimeSocket();
    const handler = (data: { depositId: string; status: string }): void => {
      if (data.status !== 'COMPLETED') return;
      setActiveDeposit((prev) => (prev && prev.id === data.depositId ? null : prev));
      setWalletDeposit((prev) => (prev && prev.id === data.depositId ? null : prev));
      toast.success('Баланс пополнен');
      if (onSuccess) onSuccess();
      router.refresh();
    };
    socket.on('deposit:updated', handler);
    return () => {
      socket.off('deposit:updated', handler);
    };
  }, [onSuccess, router]);

  useEffect(() => {
    if (activeDeposit !== null) return;
    let cancelled = false;
    setMethodsLoading(true);
    paymentMethodsApi
      .list('DEPOSIT')
      .then((res) => {
        if (cancelled) return;
        setMethods(res.items);
        if (res.items.length > 0) setSelectedId((prev) => prev ?? res.items[0]!.id);
      })
      .catch((e) => {
        if (cancelled) return;
        setMethodsError(
          e instanceof ApiException ? e.message : 'Не удалось загрузить способы оплаты',
        );
      })
      .finally(() => {
        if (!cancelled) setMethodsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeDeposit]);

  const handleExpire = useCallback((): void => {
    setActiveDeposit(null);
    router.refresh();
  }, [router]);

  /** Крипто-метод: адрес выдаётся сразу при выборе, сумма не нужна. */
  const handleSelect = useCallback((m: PublicPaymentMethod): void => {
    setSelectedId(m.id);
    setErrorMessage(null);
    setWalletDeposit(null);
    if (m.provider !== 'WESTWALLET') return;
    setWalletCreating(true);
    depositsApi
      .create({ paymentMethodId: m.id, amountMinor: '0' })
      .then(setWalletDeposit)
      .catch((err) => {
        setErrorMessage(
          err instanceof ApiException ? err.message : 'Не удалось получить адрес кошелька',
        );
      })
      .finally(() => setWalletCreating(false));
  }, []);

  const selected = methods.find((m) => m.id === selectedId) ?? null;
  const isCrypto = selected?.provider === 'WESTWALLET';
  const minMinor =
    selected && BigInt(selected.minAmountMinor) > 0n ? BigInt(selected.minAmountMinor) : FALLBACK_MIN;
  const maxMinor =
    selected && BigInt(selected.maxAmountMinor) > 0n ? BigInt(selected.maxAmountMinor) : FALLBACK_MAX;

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setErrorMessage(null);
    if (!selected) {
      setErrorMessage('Выберите способ оплаты');
      return;
    }
    if (isCrypto) return;

    const minor = parseAmountToMinor(amount);
    if (minor === null) {
      setErrorMessage('Введите корректную сумму');
      return;
    }
    if (minor < minMinor || minor > maxMinor) {
      setErrorMessage('Сумма вне допустимого диапазона');
      return;
    }

    startTransition(async () => {
      try {
        const created = await depositsApi.create({
          paymentMethodId: selected.id,
          amountMinor: minor.toString(),
        });
        setActiveDeposit(created);
        setAmount('');
        router.refresh();
      } catch (err) {
        setErrorMessage(
          err instanceof ApiException ? err.message : 'Не удалось создать пополнение',
        );
      }
    });
  };

  if (activeDeposit === undefined) return <PanelSkeleton />;

  // Есть активный счёт — показываем реквизиты вместо формы
  if (activeDeposit !== null) {
    return (
      <div className="space-y-3">
        <RequisiteCard deposit={activeDeposit} locale={locale} onExpire={handleExpire} />
        <p className="text-center text-xs text-text-muted">
          Новое пополнение можно создать после оплаты этого счёта или по истечении таймера.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {methodsLoading ? (
        <PanelSkeleton />
      ) : methodsError ? (
        <PanelMessage variant="danger">{methodsError}</PanelMessage>
      ) : methods.length === 0 ? (
        <PanelMessage variant="warning">Способы оплаты временно недоступны</PanelMessage>
      ) : (
        <>
          <MethodPicker
            methods={methods}
            selectedId={selectedId}
            onSelect={handleSelect}
            disabled={isPending || walletCreating}
            label="Способ оплаты"
          />

          {!isCrypto && (
            <AmountField
              label="Сумма пополнения"
              value={amount}
              onChange={setAmount}
              disabled={isPending || !selected}
              minMinor={minMinor}
              maxMinor={maxMinor}
            />
          )}

          {isCrypto && (
            <div>
              {walletCreating && <PanelSkeleton lines={2} />}
              {!walletCreating && walletDeposit && (
                <RequisiteCard deposit={walletDeposit} locale={locale} />
              )}
            </div>
          )}

          {errorMessage && <PanelMessage variant="danger">{errorMessage}</PanelMessage>}

          {!isCrypto && (
            <SubmitButton loading={isPending} disabled={!selected}>
              {isPending ? 'Создаём счёт…' : 'Пополнить'}
            </SubmitButton>
          )}
        </>
      )}
    </form>
  );
}
