'use client';

import { useId, type ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { Label } from '../Label';

export interface FormFieldProps {
  /** id для связки label↔input; если не передан — генерируется */
  htmlFor?: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  /** render-prop, получает id для связки */
  children: (id: string) => ReactNode;
}

/**
 * Универсальный wrapper для пары label + контрол + hint/error.
 * Использовать ВСЕГДА вместо ручной разметки полей формы.
 */
export function FormField({
  htmlFor,
  label,
  hint,
  error,
  required,
  className,
  children,
}: FormFieldProps): JSX.Element {
  const autoId = useId();
  const id = htmlFor ?? autoId;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? (
        <Label htmlFor={id} required={required}>
          {label}
        </Label>
      ) : null}
      {children(id)}
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
