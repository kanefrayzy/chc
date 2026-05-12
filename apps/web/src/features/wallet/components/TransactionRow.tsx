import { Badge } from '@chcgreen/ui';
import type { TransactionDto, TransactionStatus, TransactionType } from '@/lib/api/wallet';
import { formatMinorAmount } from '@/lib/format/money';

export interface TransactionRowProps {
  tx: TransactionDto;
  /** Локализованный лейбл типа (например `t('wallet.tx.DEPOSIT')`). */
  typeLabel: string;
  /** Локаль форматирования даты. */
  locale: string;
}

const STATUS_VARIANT: Record<TransactionStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  COMPLETED: 'success',
  PENDING: 'warning',
  FAILED: 'danger',
  REVERSED: 'neutral',
};

const POSITIVE_TYPES: ReadonlySet<TransactionType> = new Set<TransactionType>([
  'DEPOSIT',
  'BET_WIN',
  'BET_REFUND',
  'CODE_RELEASE',
  'CODE_REFUND',
  'REFERRAL_EARNING',
  'CASE_WIN',
  'JACKPOT_WIN',
]);

function isPositive(type: TransactionType, amountMinor: string): boolean {
  if (BigInt(amountMinor) > 0n) return true;
  if (BigInt(amountMinor) < 0n) return false;
  return POSITIVE_TYPES.has(type);
}

export function TransactionRow({ tx, typeLabel, locale }: TransactionRowProps): JSX.Element {
  const positive = isPositive(tx.type, tx.amountMinor);
  const date = new Date(tx.createdAt).toLocaleString(locale === 'az' ? 'az-AZ' : 'ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-text-primary">{typeLabel}</span>
        <span className="text-xs text-text-secondary">{date}</span>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant={STATUS_VARIANT[tx.status]}>{tx.status}</Badge>
        <span
          className={
            positive ? 'font-semibold text-brand' : 'font-semibold text-accent-red'
          }
        >
          {formatMinorAmount(tx.amountMinor)}
        </span>
      </div>
    </div>
  );
}
