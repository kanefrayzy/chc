'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@chcgreen/ui';
import { CloseIcon } from '@/components/icons';

export interface MinesInfoModalProps {
  open: boolean;
  onClose: () => void;
  maxBetAzn: number;
  minBetAzn: number;
}

/**
 * Информационное окно «Информация об игре» с двумя вкладками — Правила и
 * Макс. лимит ставок. Стилистика — как у референса (тёмный, неоновый).
 */
export function MinesInfoModal({ open, onClose, maxBetAzn, minBetAzn }: MinesInfoModalProps): JSX.Element | null {
  const t = useTranslations('mines.info');
  const [tab, setTab] = useState<'rules' | 'limits'>('rules');

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-3 py-6 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-bg-card p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
            <span aria-hidden="true">📑</span> {t('title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="rounded-full p-1.5 text-text-muted hover:bg-bg-elevated hover:text-text-primary"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 inline-flex rounded-full bg-bg-elevated p-1">
          <button
            type="button"
            onClick={() => setTab('rules')}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-semibold transition',
              tab === 'rules' ? 'bg-bg-base text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary',
            )}
          >
            {t('tabs.rules')}
          </button>
          <button
            type="button"
            onClick={() => setTab('limits')}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-semibold transition',
              tab === 'limits' ? 'bg-bg-base text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary',
            )}
          >
            {t('tabs.limits')}
          </button>
        </div>

        {tab === 'rules' ? (
          <ol className="list-decimal space-y-2 pl-5 text-sm text-text-secondary">
            <li>{t('rules.r1')}</li>
            <li>{t('rules.r2')}</li>
            <li>{t('rules.r3')}</li>
            <li>{t('rules.r4')}</li>
          </ol>
        ) : (
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-lg border border-border bg-bg-elevated px-3 py-2">
              <dt className="text-text-muted">{t('limits.min')}</dt>
              <dd className="font-mono font-semibold text-text-primary">{minBetAzn.toFixed(2)} AZN</dd>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-bg-elevated px-3 py-2">
              <dt className="text-text-muted">{t('limits.max')}</dt>
              <dd className="font-mono font-semibold text-text-primary">{maxBetAzn.toFixed(2)} AZN</dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}
