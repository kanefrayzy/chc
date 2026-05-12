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
      title="Вывод средств"
      size="lg"
    >
      <div className="grid gap-6 lg:grid-cols-2 p-1">
        <WithdrawForm
          balanceMinor={balanceMinor ?? '0'}
          onSuccess={() => { closeWithdraw(); refreshBalance(); }}
        />
        <div>
          <h3 className="mb-3 text-sm font-semibold text-text-secondary">История выводов</h3>
          <WithdrawalsList locale={locale} />
        </div>
      </div>
    </Modal>
  );
}
