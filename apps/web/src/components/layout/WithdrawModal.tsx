'use client';

import { Modal } from '@chcgreen/ui';
import { useUi } from './ui-context';
import { WithdrawForm } from '@/features/withdrawals/components/WithdrawForm';
import { WithdrawalsList } from '@/features/withdrawals/components/WithdrawalsList';

export interface WithdrawModalProps {
  locale: string;
  balanceMinor: string | null;
}

export function WithdrawModal({ locale, balanceMinor }: WithdrawModalProps): JSX.Element {
  const { withdrawModalOpen, closeWithdraw, refreshBalance } = useUi();

  return (
    <Modal
      open={withdrawModalOpen}
      onClose={closeWithdraw}
      size="2xl"
      title={
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-purple/15 text-accent-purple"
          >
            ↑
          </span>
          <span>Вывод средств</span>
        </span>
      }
      description="Реквизиты и сумма для вывода"
    >
      <div className="-mx-6 -my-5 bg-bg-elevated px-6 py-5">
        <div className="grid gap-5 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <WithdrawForm
              balanceMinor={balanceMinor ?? '0'}
              onSuccess={() => { closeWithdraw(); refreshBalance(); }}
            />
          </div>
          <div className="flex min-w-0 flex-col">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
              История выводов
            </h3>
            <div className="rounded-xl border border-border bg-bg-card p-4">
              <WithdrawalsList locale={locale} />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

