'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@chcgreen/ui';
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

/** Форматирует строку цифр как номер карты: 4169 5855 1234 1828 */
function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length >= 12 && digits.length <= 19) {
    return digits.match(/.{1,4}/g)?.join(' ') ?? value;
  }
  return value;
}

function isCardLike(value: string): boolean {
  return /^\d{12,19}$/.test(value.replace(/[\s\-]/g, ''));
}

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
  const [copied, setCopied] = useState(false);

  const isActive = deposit.status === 'PENDING' || deposit.status === 'PROCESSING';
  const secondsLeft = useCountdown(isActive ? deposit.expiresAt : null, onExpire);

  const totalSeconds = deposit.expiresAt
    ? Math.max(0, Math.floor((new Date(deposit.expiresAt).getTime() - new Date(deposit.createdAt).getTime()) / 1000))
    : 0;
  const progressPct =
    totalSeconds > 0 && secondsLeft !== null ? Math.round((secondsLeft / totalSeconds) * 100) : 0;

  const cardAddress = deposit.externalAddress ?? null;
  const isCard = cardAddress ? isCardLike(cardAddress) : false;

  const handleCopy = (): void => {
    if (!cardAddress) return;
    void navigator.clipboard.writeText(cardAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const displayAmount = deposit.originalAmount
    ? `${deposit.originalAmount} ${deposit.originalCurrency ?? 'AZN'}`
    : formatMinorAmount(deposit.amountMinor, { showPositiveSign: false, locale: locale as 'ru' | 'az' });

  return (
    <div className="overflow-hidden rounded-2xl border border-border-subtle bg-bg-elevated">

      {/* ── Шапка: сумма + статус ── */}
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
        <div>
          <p className="mb-1 text-xs uppercase tracking-widest text-text-muted">
            {t('expectedAmount')}
          </p>
          <p className="text-3xl font-bold leading-none text-text-primary">
            {formatMinorAmount(deposit.amountMinor, { showPositiveSign: false, locale: locale as 'ru' | 'az' })}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[deposit.status]}>{t(`status.${deposit.status}`)}</Badge>
      </div>

      {/* ── Таймер ── */}
      {isActive && secondsLeft !== null && (
        <div className="px-5 pb-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">{t('timeLeft')}</span>
            <span
              className={`font-mono text-sm font-bold tabular-nums ${
                secondsLeft < 120 ? 'text-danger' : secondsLeft < 300 ? 'text-warning' : 'text-brand'
              }`}
            >
              {secondsLeft > 0 ? formatSeconds(secondsLeft) : t('expired')}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-base">
            <div
              className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
                progressPct > 50 ? 'bg-brand' : progressPct > 20 ? 'bg-warning' : 'bg-danger'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Реквизиты карты (H2H) ── */}
      {cardAddress && (
        <div className="border-t border-border-subtle px-5 py-4 space-y-3">
          <p className="text-xs uppercase tracking-widest text-text-muted">{t('cardTitle')}</p>

          {/* Номер карты — кнопка-копирование */}
          <button
            type="button"
            onClick={handleCopy}
            className="group w-full rounded-xl border border-border-subtle bg-bg-base px-4 py-3.5 text-left transition-colors hover:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-lg font-semibold tracking-widest text-text-primary sm:text-xl">
                {isCard ? formatCardNumber(cardAddress) : cardAddress}
              </span>
              <span
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  copied
                    ? 'bg-success/20 text-success'
                    : 'bg-brand/10 text-brand group-hover:bg-brand group-hover:text-bg-base'
                }`}
              >
                {copied ? t('copied') : t('copy')}
              </span>
            </div>
          </button>

          {/* Сумма и подсказки */}
          <div className="space-y-1 text-xs text-text-muted">
            <p>
              <span className="text-text-secondary font-medium">{t('transferAmount')}:</span>{' '}
              <span className="text-text-primary font-semibold">{displayAmount}</span>
            </p>
            <p>{t('transferHint')}</p>
            <p>{t('autoCredit')}</p>
          </div>
        </div>
      )}

      {/* ── Редирект-кнопка (для не-H2H провайдеров) ── */}
      {deposit.paymentUrl && (
        <div className="border-t border-border-subtle px-5 py-4">
          <a
            href={deposit.paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center rounded-xl bg-brand py-3 text-sm font-semibold text-bg-base transition hover:opacity-90"
          >
            {t('payNow')}
          </a>
        </div>
      )}

      {/* ── Дата создания ── */}
      <div className="border-t border-border-subtle px-5 py-3">
        <p className="text-xs text-text-muted" suppressHydrationWarning>
          {new Date(deposit.createdAt).toLocaleString(locale === 'az' ? 'az-AZ' : 'ru-RU')}
        </p>
      </div>
    </div>
  );
}


