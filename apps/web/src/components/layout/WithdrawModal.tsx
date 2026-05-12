'use client';

import { Modal } from '@chcgreen/ui';
import { useUi } from './ui-context';
import { WithdrawForm } from '@/features/withdrawals/components/WithdrawForm';

export interface WithdrawModalProps {
  locale: string;
  balanceMinor: string | null;
}

export function WithdrawModal({ balanceMinor }: WithdrawModalProps): JSX.Element {
  const { withdrawModalOpen, closeWithdraw, refreshBalance } = useUi();

  return (
    <Modal
      open={withdrawModalOpen}
      onClose={closeWithdraw}
      size="md"
      title={
        <span className="flex items-center gap-2">
          <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-purple/15 text-accent-purple">
            ↑
          </span>
          <span>Вывод</span>
        </span>
      }
      description="Укажите реквизиты"
    >
      <div className="-mx-6 -my-5 bg-bg-elevated px-6 py-5">
        <WithdrawForm
          balanceMinor={balanceMinor ?? '0'}
          onSuccess={() => { closeWithdraw(); refreshBalance(); }}
        />
      </div>
    </Modal>
  );
}

