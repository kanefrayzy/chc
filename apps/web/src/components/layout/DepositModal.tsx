'use client';

import { Modal } from '@chcgreen/ui';
import { useUi } from './ui-context';
import { DepositForm } from '@/features/deposits/components/DepositForm';
import { DepositsList } from '@/features/deposits/components/DepositsList';

export interface DepositModalProps {
  locale: string;
}

export function DepositModal({ locale }: DepositModalProps): JSX.Element {
  const { depositModalOpen, closeDeposit, refreshBalance } = useUi();

  return (
    <Modal
      open={depositModalOpen}
      onClose={closeDeposit}
      size="2xl"
      title={
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex h-7 w-7 items-center justify-center rounded-md bg-brand/15 text-brand"
          >
            ↓
          </span>
          <span>Пополнение баланса</span>
        </span>
      }
      description="Выберите способ оплаты и сумму"
    >
      <div className="-mx-6 -my-5 bg-bg-elevated px-6 py-5">
        <div className="grid gap-5 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <DepositForm locale={locale} onSuccess={() => { refreshBalance(); }} />
          </div>
          <div className="flex min-w-0 flex-col">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
              История пополнений
            </h3>
            <div className="rounded-xl border border-border bg-bg-card p-4">
              <DepositsList locale={locale} />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

