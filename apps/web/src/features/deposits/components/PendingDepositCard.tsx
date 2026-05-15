'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardBody, CardHeader, Badge } from '@chcgreen/ui';
import type { DepositDto } from '@/lib/api/deposits';
import { formatMinorAmount } from '@/lib/format/money';

export interface PendingDepositCardProps {
  deposit: DepositDto;
  locale: string;
  onExpire?: () => void;
}

const STATUS_VARIANT: Record<DepositDto['status'], 'warning' | 'info' | 'success' | 'danger'> = {
  PENDING: 'warning',
  PROCESSING: 'info',
  COMPLETED: 'success',
  FAILED: 'danger',
  EXPIRED: 'danger',
};

/** Маскирует строку как номер банковской карты: **** **** **** 1234 */
function maskCard(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 12 || digits.length > 19) return value;
  const last4 = digits.slice(-4);
  const groups = Math.ceil((digits.length - 4) / 4);
  return Array(groups).fill('****').join(' ') + ' ' + last4;
}

function isCardLike(value: string): boolean {
  const digits = value.replace(/[\s\-]/g, '');
  return /^\d{12,19}$/.test(digits);
}

/** Считает секунды до expiresAt. Возвращает null, если expiresAt не задан. */
function useCountdown(expiresAt: string | null, onExpire?: () => void): number | null {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(() => {
    if (!expiresAt) return null;
    return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!expiresAt) return;
    const tick = (): void => {
      const left = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0 && onExpire) onExpire();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onExpire]);

  return secondsLeft;
}

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function PendingDepositCard({ deposit, locale, onExpire }: PendingDepositCardProps): JSX.Element {
  const t = useTranslations('deposit.card');
  const isActive = deposit.status === 'PENDING' || deposit.status === 'PROCESSING';
  const secondsLeft = useCountdown(isActive ? deposit.expiresAt : null, onExpire);

  const totalSeconds = deposit.expiresAt
    ? Math.max(0, Math.floor((new Date(deposit.expiresAt).getTime() - new Date(deposit.createdAt).getTime()) / 1000))
    : 0;
  const progressPct = totalSeconds > 0 && secondsLeft !== null
    ? Math.round((secondsLeft / totalSeconds) * 100)
    : 0;

  return (
    <Card variant="elevated">
      <CardHeader className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-text-muted">
            {t('provider')}: {deposit.provider === 'BETRA_H2H' ? 'Limpay' : 'WestWallet'}
          </div>
          <div className="text-lg font-semibold text-text-primary">
            {formatMinorAmount(deposit.amountMinor, { locale: locale as 'ru' | 'az' })}
          </div>
        </div>
        <Badge variant={STATUS_VARIANT[deposit.status]}>{t(`status.${deposit.status}`)}</Badge>
      </CardHeader>
      <CardBody className="space-y-3 text-sm text-text-secondary">
        {/* Countdown timer */}
        {isActive && secondsLeft !== null && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">{t('timeLeft')}</span>
              <span className={secondsLeft < 60 ? 'font-bold text-danger' : 'font-medium text-text-primary'}>
                {secondsLeft > 0 ? formatSeconds(secondsLeft) : t('expired')}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-elevated">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  progressPct > 30 ? 'bg-brand' : progressPct > 10 ? 'bg-warning' : 'bg-danger'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {deposit.paymentUrl ? (
          <a
            href={deposit.paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-bg-base transition hover:bg-brand-dim"
          >
            {t('payNow')}
          </a>
        ) : null}

        {deposit.externalAddress ? (
          <div>
            <div className="text-xs text-text-muted">{t('address')}</div>
            <div className="mt-0.5 flex items-center gap-2">
              <code className="block flex-1 break-all rounded bg-bg-elevated px-2 py-1 text-xs font-mono text-text-primary">
                {isCardLike(deposit.externalAddress)
                  ? maskCard(deposit.externalAddress)
                  : deposit.externalAddress}
              </code>
              {isCardLike(deposit.externalAddress) && (
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(deposit.externalAddress!)}
                  className="shrink-0 rounded bg-bg-elevated px-2 py-1 text-xs text-text-muted hover:text-text-primary"
                  title={t('copy')}
                >
                  ⎘
                </button>
              )}
            </div>
          </div>
        ) : null}

        {deposit.originalAmount && deposit.originalCurrency ? (
          <div className="text-xs text-text-muted">
            {t('expectedAmount')}: {deposit.originalAmount} {deposit.originalCurrency}
          </div>
        ) : null}
        <div className="text-xs text-text-muted" suppressHydrationWarning>
          {new Date(deposit.createdAt).toLocaleString(locale === 'az' ? 'az-AZ' : 'ru-RU')}
        </div>
      </CardBody>
    </Card>
  );
}

