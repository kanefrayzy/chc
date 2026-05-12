import { Card } from '@chcgreen/ui';
import { formatMinorAmount } from '@/lib/format/money';

export interface BalanceCardProps {
  balanceMinor: string;
  totalWageredMinor: string;
  /** Заголовок карточки (через i18n). */
  title: string;
  /** Подпись «Всего ставок». */
  wageredLabel: string;
}

export function BalanceCard({
  balanceMinor,
  totalWageredMinor,
  title,
  wageredLabel,
}: BalanceCardProps): JSX.Element {
  return (
    <Card variant="elevated" padding="lg">
      <div className="text-sm uppercase tracking-wider text-text-secondary">{title}</div>
      <div className="mt-2 text-4xl font-extrabold text-text-primary">
        {formatMinorAmount(balanceMinor, { showPositiveSign: false })}
      </div>
      <div className="mt-4 text-sm text-text-secondary">
        {wageredLabel}:{' '}
        <span className="text-text-primary">
          {formatMinorAmount(totalWageredMinor, { showPositiveSign: false })}
        </span>
      </div>
    </Card>
  );
}
