'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createPortal } from 'react-dom';
import { DepositPanel } from './DepositPanel';
import { WithdrawPanel } from './WithdrawPanel';
import { formatMinorAmount } from '@/lib/format/money';

export type WalletTab = 'deposit' | 'withdraw';

export interface WalletModalProps {
  open: boolean;
  tab: WalletTab;
  onTabChange: (tab: WalletTab) => void;
  onClose: () => void;
  locale: string;
  balanceMinor: string | null;
  onBalanceRefresh?: () => void;
}

const TABS: WalletTab[] = ['deposit', 'withdraw'];

/**
 * Модальное окно кошелька: единая шапка с балансом, переключатель
 * «Пополнить / Вывести» и соответствующая панель.
 */
export function WalletModal({
  open,
  tab,
  onTabChange,
  onClose,
  locale,
  balanceMinor,
  onBalanceRefresh,
}: WalletModalProps): JSX.Element | null {
  const t = useTranslations('wallet');
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const handleSuccess = useCallback((): void => {
    if (onBalanceRefresh) onBalanceRefresh();
  }, [onBalanceRefresh]);

  if (!open || !mounted) return null;

  const isDeposit = tab === 'deposit';
  const accentGradient = isDeposit
    ? 'from-brand/20 via-brand/[0.06] to-transparent'
    : 'from-accent-purple/20 via-accent-purple/[0.06] to-transparent';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('modal.title')}
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
    >
      <button
        type="button"
        aria-label={t('modal.close')}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/75 backdrop-blur-sm"
      />

      <div className="relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-border bg-bg-elevated shadow-[0_-8px_60px_rgba(0,0,0,0.6)] sm:max-w-[460px] sm:rounded-3xl sm:shadow-[0_20px_70px_rgba(0,0,0,0.65)]">
        {/* Шапка с балансом */}
        <div className={`relative bg-gradient-to-br px-5 pb-4 pt-5 ${accentGradient}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted">
                {t('modal.balance')}
              </p>
              <p className="mt-1 text-3xl font-bold leading-none tabular-nums text-text-primary">
                {balanceMinor !== null
                  ? formatMinorAmount(balanceMinor, {
                      showPositiveSign: false,
                      locale: locale as 'ru' | 'az',
                    })
                  : '—'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('modal.close')}
              className="-mr-1 -mt-1 rounded-lg p-2 text-text-muted transition-colors hover:bg-bg-card hover:text-text-primary"
            >
              <svg viewBox="0 0 20 20" className="h-4.5 w-4.5" width="18" height="18" aria-hidden>
                <path
                  d="M5 5l10 10M15 5L5 15"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {/* Переключатель вкладок */}
          <div
            role="tablist"
            className="mt-4 flex gap-1 rounded-xl border border-border bg-bg-base/80 p-1"
          >
            {TABS.map((id) => {
              const active = id === tab;
              const activeClasses =
                id === 'deposit'
                  ? 'bg-brand text-bg-base shadow-[0_0_20px_rgba(0,255,136,0.25)]'
                  : 'bg-accent-purple text-white shadow-[0_0_20px_rgba(162,89,255,0.25)]';
              return (
                <button
                  key={id}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => onTabChange(id)}
                  className={[
                    'flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all',
                    active ? activeClasses : 'text-text-secondary hover:bg-bg-card hover:text-text-primary',
                  ].join(' ')}
                >
                  {t(`modal.${id}`)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Контент */}
        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-4">
          {isDeposit ? (
            <DepositPanel locale={locale} onSuccess={handleSuccess} />
          ) : (
            <WithdrawPanel
              balanceMinor={balanceMinor ?? '0'}
              locale={locale}
              onSuccess={handleSuccess}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
