'use client';

import { FormField, Input } from '@chcgreen/ui';
import type { CreateWithdrawalDestination, WithdrawalMethod } from '@/lib/api/withdrawals';

export interface DestinationFieldsProps {
  method: WithdrawalMethod;
  destination: CreateWithdrawalDestination;
  onChange: (next: CreateWithdrawalDestination) => void;
  disabled?: boolean;
  labels: {
    cardNumber: string;
    cardHolder: string;
    walletAddress: string;
    manualDetails: string;
  };
}

export function DestinationFields({
  method,
  destination,
  onChange,
  disabled,
  labels,
}: DestinationFieldsProps): JSX.Element {
  if (method === 'AUTO_BETRA_H2H') {
    const value = destination.kind === 'card' ? destination : { kind: 'card' as const, cardNumber: '' };
    return (
      <div className="grid gap-3">
        <FormField label={labels.cardNumber} required>
          {(id) => (
            <Input
              id={id}
              value={value.cardNumber}
              disabled={disabled}
              inputMode="numeric"
              maxLength={23}
              onChange={(e) => onChange({ ...value, cardNumber: e.target.value })}
              placeholder="0000 0000 0000 0000"
            />
          )}
        </FormField>
        <FormField label={labels.cardHolder}>
          {(id) => (
            <Input
              id={id}
              value={value.cardHolder ?? ''}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, cardHolder: e.target.value })}
              placeholder="IVAN IVANOV"
            />
          )}
        </FormField>
      </div>
    );
  }

  if (method === 'AUTO_WESTWALLET') {
    const value =
      destination.kind === 'crypto'
        ? destination
        : { kind: 'crypto' as const, walletAddress: '', network: 'TRC20' as const };
    return (
      <FormField label={labels.walletAddress} hint="USDT TRC20" required>
        {(id) => (
          <Input
            id={id}
            value={value.walletAddress}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, walletAddress: e.target.value, network: 'TRC20' })}
            placeholder="T..."
          />
        )}
      </FormField>
    );
  }

  const value = destination.kind === 'manual' ? destination : { kind: 'manual' as const, details: '' };
  return (
    <FormField label={labels.manualDetails} required>
      {(id) => (
        <Input
          id={id}
          value={value.details}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, details: e.target.value })}
        />
      )}
    </FormField>
  );
}
