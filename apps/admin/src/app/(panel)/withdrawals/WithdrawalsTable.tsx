'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  adminApi,
  type AdminWithdrawalRow,
  type PayoutStatusInfo,
  type WithdrawalStatus,
} from '../../../lib/api/admin';
import { ApiException } from '../../../lib/api/client';
import { minorToAzn, formatDateTime, shortId } from '../../../lib/format';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/ui/DataTable';
import { WithdrawalStatusFilter } from './WithdrawalStatusFilter';
import { RejectModal } from '../code-purchases/RejectModal';

const statusTone: Record<
  WithdrawalStatus,
  'neutral' | 'info' | 'warning' | 'success' | 'danger'
> = {
  PENDING: 'warning',
  PROCESSING: 'info',
  COMPLETED: 'success',
  REJECTED: 'danger',
  FAILED: 'danger',
  CANCELLED: 'neutral',
};

const statusLabel: Record<WithdrawalStatus, string> = {
  PENDING: 'Ожидает',
  PROCESSING: 'В работе',
  COMPLETED: 'Завершён',
  REJECTED: 'Отклонён',
  FAILED: 'Ошибка',
  CANCELLED: 'Отменён',
};

const methodLabel: Record<AdminWithdrawalRow['method'], string> = {
  AUTO_BETATRANSFER: 'Карта (Betatransfer)',
  AUTO_WESTWALLET: 'Крипто (Westwallet)',
  MANUAL_MODERATOR: 'Вручную',
};

/** Что означает статус на стороне Betatransfer — простыми словами. */
const providerStatusLabel: Record<string, string> = {
  new: 'Принята провайдером, ещё не обработана',
  pending: 'Провайдер обрабатывает выплату',
  verification: 'Провайдер проверяет получателя',
  checkPayment: 'Ручная проверка на стороне провайдера',
  success: 'Деньги отправлены на карту',
  partial_withdraw: 'Выплачено частично',
  cancel: 'Провайдер отменил выплату',
  error: 'Ошибка на стороне провайдера',
  blocked: 'Выплата заблокирована',
  not_paid: 'Не оплачена',
  not_paid_timeout: 'Истёк срок обработки',
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-ink-400">{label}</div>
      <div className="text-sm text-ink-900">{value}</div>
    </div>
  );
}

export function WithdrawalsTable({
  initialItems,
  status,
}: {
  initialItems: AdminWithdrawalRow[];
  status: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminWithdrawalRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [payoutInfo, setPayoutInfo] = useState<Record<string, PayoutStatusInfo>>({});
  const [payoutError, setPayoutError] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    try {
      const res = await adminApi.withdrawals.list({ status, limit: 50 });
      setItems(res.items);
    } catch {
      router.refresh();
    }
  }, [status, router]);

  // Смена таба меняет только query-параметр, поэтому серверные пропсы могут
  // остаться прежними — данные под новый статус забираем сами.
  const mountedStatus = useRef(status);
  useEffect(() => {
    if (mountedStatus.current === status) return;
    mountedStatus.current = status;
    setError(null);
    setLoading(true);
    void refresh().finally(() => setLoading(false));
  }, [status, refresh]);

  // Подтверждение в один клик — без промежуточного окна
  async function onApprove(id: string) {
    setError(null);
    setApprovingId(id);
    try {
      await adminApi.withdrawals.approve(id, {});
      await refresh();
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Не удалось подтвердить');
    } finally {
      setApprovingId(null);
    }
  }

  // Сверка с Betatransfer: показывает, что там с выплатой, и подхватывает
  // финальный статус, если колбэк до нас не дошёл.
  async function onCheckPayout(id: string) {
    setCheckingId(id);
    setPayoutError((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const info = await adminApi.withdrawals.payoutStatus(id);
      setPayoutInfo((prev) => ({ ...prev, [id]: info }));
      if (info.applied) await refresh();
    } catch (e) {
      setPayoutError((prev) => ({
        ...prev,
        [id]: e instanceof ApiException ? e.message : 'Не удалось получить статус',
      }));
    } finally {
      setCheckingId(null);
    }
  }

  async function onReject(id: string, reason: string) {
    setError(null);
    try {
      await adminApi.withdrawals.reject(id, { reason });
      setRejectTarget(null);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Не удалось отклонить');
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <WithdrawalStatusFilter value={status} />
        <Button variant="ghost" size="sm" onClick={() => void refresh()}>
          Обновить
        </Button>
      </div>

      {error && <div className="mb-3 text-sm text-danger">{error}</div>}

      <DataTable
        rows={loading ? [] : items}
        empty={loading ? 'Загружаем…' : 'Нет заявок'}
        columns={[
          {
            key: 'id',
            header: 'ID',
            cell: (r) => <span className="font-mono text-xs text-ink-500">{shortId(r.id)}</span>,
          },
          {
            key: 'user',
            header: 'Пользователь',
            cell: (r) => (
              <div>
                <div className="text-sm text-ink-900">{r.username ?? '—'}</div>
                <div className="text-xs text-ink-400 font-mono">{shortId(r.userId)}</div>
              </div>
            ),
          },
          {
            key: 'amount',
            header: 'Сумма',
            align: 'right',
            cell: (r) => <span className="font-mono tabular-nums">{minorToAzn(r.amountMinor)}</span>,
          },
          {
            key: 'method',
            header: 'Метод',
            cell: (r) => (
              <div>
                <div className="text-sm text-ink-700">{methodLabel[r.method]}</div>
                <div className="text-xs text-ink-400 font-mono">{r.destination.display}</div>
              </div>
            ),
          },
          {
            key: 'status',
            header: 'Статус',
            cell: (r) => <Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge>,
          },
          {
            key: 'created',
            header: 'Создан',
            cell: (r) => <span className="text-sm text-ink-500">{formatDateTime(r.createdAt)}</span>,
          },
          {
            key: 'actions',
            header: '',
            align: 'right',
            cell: (r) => {
              if (r.status !== 'PENDING' && r.status !== 'PROCESSING') return null;
              return (
                <div className="flex items-center gap-2 justify-end">
                  {r.status === 'PROCESSING' && r.method === 'AUTO_BETATRANSFER' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={checkingId === r.id}
                      onClick={() => void onCheckPayout(r.id)}
                    >
                      {checkingId === r.id ? 'Проверяем…' : 'Проверить статус'}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="success"
                    disabled={approvingId === r.id}
                    onClick={() => void onApprove(r.id)}
                  >
                    {approvingId === r.id ? 'Отправляем…' : 'Подтвердить'}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setRejectTarget(r)}>
                    Отклонить
                  </Button>
                </div>
              );
            },
          },
        ]}
        renderDetail={(r) => {
          const info = payoutInfo[r.id];
          const err = payoutError[r.id];
          // Панель нужна только там, где есть что рассказать о выплате
          if (!info && !err && !(r.status === 'PROCESSING' || r.status === 'FAILED')) return null;

          return (
            <div className="rounded-lg border border-border bg-surface p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">
                Выплата через Betatransfer
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <InfoRow label="Заявка" value={r.id} />
                <InfoRow label="ID у провайдера" value={r.externalId ?? 'ещё не присвоен'} />
                <InfoRow label="Карта получателя" value={r.destination.display} />
                <InfoRow label="Сумма к зачислению" value={`${minorToAzn(r.amountMinor)} AZN`} />

                {info && (
                  <>
                    <InfoRow
                      label="Статус у провайдера"
                      value={
                        providerStatusLabel[info.providerStatus] ??
                        info.providerStatus ??
                        'неизвестен'
                      }
                    />
                    {info.amount && (
                      <InfoRow
                        label="Списано с баланса"
                        value={`${info.amount} ${info.currency ?? ''}`.trim()}
                      />
                    )}
                    {info.commission && <InfoRow label="Комиссия" value={info.commission} />}
                    {info.paymentSystem && (
                      <InfoRow label="Платёжная система" value={info.paymentSystem} />
                    )}
                    {info.updatedAt && (
                      <InfoRow label="Обновлено провайдером" value={info.updatedAt} />
                    )}
                  </>
                )}

                {r.reason && <InfoRow label="Причина" value={r.reason} />}
              </div>

              {info?.applied && (
                <div className="mt-2 text-xs text-success">
                  Статус применён — заявка обновлена.
                </div>
              )}
              {info && !info.applied && info.status === 'PENDING' && (
                <div className="mt-2 text-xs text-ink-500">
                  Выплата ещё в работе у провайдера — ждём финальный статус.
                </div>
              )}
              {err && <div className="mt-2 text-xs text-danger">{err}</div>}
              {!info && !err && r.status === 'PROCESSING' && (
                <div className="mt-2 text-xs text-ink-500">
                  Отправлено провайдеру, ждём колбэк. Нажмите «Проверить статус», чтобы
                  спросить Betatransfer напрямую.
                </div>
              )}
            </div>
          );
        }}
      />

      <RejectModal
        title="Отклонить вывод"
        target={rejectTarget}
        onClose={() => setRejectTarget(null)}
        onSubmit={onReject}
      />
    </div>
  );
}
