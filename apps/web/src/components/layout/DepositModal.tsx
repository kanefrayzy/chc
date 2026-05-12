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
      title="Пополнение баланса"
      size="lg"
    >
      <div className="grid gap-6 lg:grid-cols-2 p-1">
        <DepositForm locale={locale} onSuccess={() => { refreshBalance(); }} />
        <div>
          <h3 className="mb-3 text-sm font-semibold text-text-secondary">История пополнений</h3>
          <DepositsList locale={locale} />
        </div>
      </div>
    </Modal>
  );
}
