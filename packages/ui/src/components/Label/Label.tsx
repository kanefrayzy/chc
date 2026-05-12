'use client';

import { type LabelHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export function Label({ required, className, children, ...rest }: LabelProps): JSX.Element {
  return (
    <label
      className={cn(
        'block text-xs font-medium uppercase tracking-wider text-text-secondary',
        className,
      )}
      {...rest}
    >
      {children}
      {required ? <span className="ml-1 text-danger">*</span> : null}
    </label>
  );
}
