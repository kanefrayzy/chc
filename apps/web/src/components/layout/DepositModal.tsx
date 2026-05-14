'use client';

import { Modal } from '@chcgreen/ui';
import { useUi } from './ui-context';
import { ArrowDownIcon } from '@/components/icons';
import { DepositForm } from '@/features/deposits/components/DepositForm';

export interface DepositModalProps {
  locale: string;
}

export function DepositModal({ locale }: DepositModalProps): JSX.Element {
  const { depositModalOpen, closeDeposit, refreshBalance } = useUi();

  return (
    <Modal
      open={depositModalOpen}
      onClose={closeDeposit}
      size="md"
      title={
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex h-7 w-7 items-center justify-center rounded-md bg-brand/15 text-brand"
          >
            <ArrowDownIcon className="h-4 w-4" />
          </span>
          <span>Пополнение</span>
        </span>
      }
      description="Зачисление мгновенно"
    >
      <div className="-mx-6 -my-5 bg-bg-elevated px-6 py-5">
        <DepositForm locale={locale} onSuccess={() => { refreshBalance(); }} />
      </div>
    </Modal>
  );
}

