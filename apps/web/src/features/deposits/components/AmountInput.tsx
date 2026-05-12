'use client';

import { useMemo } from 'react';
import { FormField, Input } from '@chcgreen/ui';

export interface AmountInputProps {
  /** Текущее значение в МАЖОРНЫХ единицах (AZN, строкой типа "12.34"). */
  value: string;
  onChange: (value: string) => void;
  label: string;
  hint?: string;
  errorMessage?: string;
  disabled?: boolean;
  /** Минор-границы для валидации (мажорные = minor/100). */
  minMinor: bigint;
  maxMinor: bigint;
}

const AMOUNT_REGEX = /^\d{0,7}([.,]\d{0,2})?$/;

export function AmountInput({
  value,
  onChange,
  label,
  hint,
  errorMessage,
  disabled,
  minMinor,
  maxMinor,
}: AmountInputProps): JSX.Element {
  const computedHint = useMemo(() => {
    if (errorMessage) return undefined;
    if (hint) return hint;
    const min = (Number(minMinor) / 100).toFixed(2);
    const max = (Number(maxMinor) / 100).toFixed(2);
    return `${min} – ${max} AZN`;
  }, [errorMessage, hint, minMinor, maxMinor]);

  return (
    <FormField label={label} hint={computedHint} error={errorMessage} required>
      {(id) => (
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          disabled={disabled}
          onChange={(e) => {
            const next = e.target.value;
            if (next === '' || AMOUNT_REGEX.test(next)) onChange(next);
          }}
          placeholder="0.00"
          aria-invalid={Boolean(errorMessage)}
        />
      )}
    </FormField>
  );
}

/** Конвертирует пользовательский ввод "12.34"/"12,34" в строку qəpik ("1234"). */
export function parseAmountToMinor(input: string): bigint | null {
  const normalized = input.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [major, fraction = ''] = normalized.split('.');
  const padded = (fraction + '00').slice(0, 2);
  return BigInt(major!) * 100n + BigInt(padded);
}
