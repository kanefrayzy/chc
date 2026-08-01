'use client';

import { useCallback, useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import type { DepositDto } from '@/lib/api/deposits';

export interface RequisiteCardProps {
  deposit: DepositDto;
  locale: string;
  onExpire?: () => void;
}

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length >= 12 && digits.length <= 19) {
    return digits.match(/.{1,4}/g)?.join(' ') ?? value;
  }
  return value;
}

function isCardLike(value: string): boolean {
  return /^\d{12,19}$/.test(value.replace(/[\s-]/g, ''));
}

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function useCountdown(expiresAt: string | null, onExpire?: () => void): number | null {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(() =>
    expiresAt ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)) : null,
  );

  useEffect(() => {
    if (!expiresAt) {
      setSecondsLeft(null);
      return;
    }
    let fired = false;
    const tick = (): void => {
      const left = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0 && !fired) {
        fired = true;
        if (onExpire) onExpire();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onExpire]);

  return secondsLeft;
}

/** Кнопка «скопировать» с состоянием подтверждения. */
function CopyButton({ value, className = '' }: { value: string; className?: string }): JSX.Element {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((): void => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }, [value]);

  return (
    <button
      type="button"
      onClick={copy}
      aria-label="Скопировать"
      className={[
        'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all',
        copied
          ? 'bg-brand text-bg-base'
          : 'bg-bg-card-hover text-text-secondary hover:bg-brand hover:text-bg-base',
        className,
      ].join(' ')}
    >
      {copied ? (
        <>
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
            <path
              d="M3.5 8.5l3 3 6-6.5"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Скопировано
        </>
      ) : (
        <>
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
            <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <path d="M10.5 3.5h-7a1 1 0 00-1 1v7" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
          Копировать
        </>
      )}
    </button>
  );
}

/**
 * Карточка активного счёта: сумма, таймер, реквизиты для перевода.
 * Для крипты — QR-код и адрес, для карты — форматированный номер, банк и владелец.
 */
export function RequisiteCard({ deposit, locale, onExpire }: RequisiteCardProps): JSX.Element {
  const isCrypto = deposit.provider === 'WESTWALLET';
  const isActive = deposit.status === 'PENDING' || deposit.status === 'PROCESSING';
  const secondsLeft = useCountdown(isActive && !isCrypto ? deposit.expiresAt : null, onExpire);

  const totalSeconds =
    !isCrypto && deposit.expiresAt
      ? Math.max(
          1,
          Math.floor(
            (new Date(deposit.expiresAt).getTime() - new Date(deposit.createdAt).getTime()) / 1000,
          ),
        )
      : 0;
  const progressPct =
    totalSeconds > 0 && secondsLeft !== null
      ? Math.min(100, Math.max(0, Math.round((secondsLeft / totalSeconds) * 100)))
      : 0;
  const urgent = secondsLeft !== null && secondsLeft < 120;

  const requisite = deposit.externalAddress;
  const details = deposit.requisiteDetails ?? null;
  const amountLabel = deposit.originalAmount
    ? `${deposit.originalAmount} ${deposit.originalCurrency ?? 'AZN'}`
    : `${(Number(deposit.amountMinor) / 100).toFixed(2)} AZN`;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-bg-card">
      {/* Сумма + таймер */}
      <div className="relative border-b border-border bg-gradient-to-br from-brand/[0.08] via-transparent to-transparent px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
              {isCrypto ? 'Пополнение USDT' : 'Переведите ровно'}
            </p>
            <p className="mt-1 text-[28px] font-bold leading-none tabular-nums text-text-primary">
              {isCrypto ? 'Любая сумма' : amountLabel}
            </p>
          </div>
          {!isCrypto && secondsLeft !== null && (
            <div className="text-right">
              <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                Осталось
              </p>
              <p
                className={`mt-1 font-mono text-xl font-bold leading-none tabular-nums ${
                  urgent ? 'text-danger' : 'text-brand'
                }`}
              >
                {secondsLeft > 0 ? formatSeconds(secondsLeft) : '00:00'}
              </p>
            </div>
          )}
        </div>
        {!isCrypto && secondsLeft !== null && (
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-bg-base">
            <div
              className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
                urgent ? 'bg-danger' : 'bg-brand'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}
      </div>

      {/* Реквизиты */}
      {requisite && (
        <div className="space-y-3 px-5 py-4">
          {isCrypto && (
            <div className="flex justify-center">
              <div className="rounded-xl bg-white p-2.5">
                <QRCode value={requisite} size={140} />
              </div>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-text-muted">
              {isCrypto ? 'Адрес кошелька' : 'Номер карты'}
            </p>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-bg-base p-2 pl-3.5">
              <span
                className={`min-w-0 flex-1 font-mono font-semibold text-text-primary ${
                  isCrypto ? 'break-all text-xs leading-relaxed' : 'text-lg tracking-wide'
                }`}
              >
                {isCardLike(requisite) ? formatCardNumber(requisite) : requisite}
              </span>
              <CopyButton value={requisite} />
            </div>
          </div>

          {/* Банк и владелец карты */}
          {(details?.bank || details?.owner) && (
            <div className="grid gap-2 sm:grid-cols-2">
              {details.bank && (
                <div className="rounded-xl border border-border bg-bg-base px-3.5 py-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">Банк</p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-text-primary">{details.bank}</p>
                </div>
              )}
              {details.owner && (
                <div className="rounded-xl border border-border bg-bg-base px-3.5 py-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                    Получатель
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-text-primary">{details.owner}</p>
                </div>
              )}
            </div>
          )}

          {/* Инструкция */}
          <ul className="space-y-1.5 rounded-xl bg-bg-base/60 px-3.5 py-3">
            {!isCrypto && (
              <li className="flex gap-2 text-xs text-text-secondary">
                <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                <span>
                  Переведите <span className="font-semibold text-text-primary">точную сумму</span> — иначе
                  платёж не будет зачислен автоматически.
                </span>
              </li>
            )}
            <li className="flex gap-2 text-xs text-text-secondary">
              <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
              <span>Баланс пополнится автоматически в течение 1–5 минут после перевода.</span>
            </li>
            {!isCrypto && (
              <li className="flex gap-2 text-xs text-text-secondary">
                <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-text-muted" />
                <span>Реквизиты действуют только для этого платежа — не сохраняйте их.</span>
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Эквайринг: реквизитов нет, оплата на стороне провайдера — даём вернуться к оплате */}
      {!requisite && deposit.paymentUrl && (
        <div className="border-t border-border px-5 py-4">
          <a
            href={deposit.paymentUrl}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand py-3 text-sm font-bold text-bg-base transition-all hover:bg-brand-dim hover:shadow-[0_0_28px_rgba(0,255,136,0.35)]"
          >
            Продолжить оплату
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
              <path
                d="M4 8h8m-3.5-3.5L12 8l-3.5 3.5"
                stroke="currentColor"
                strokeWidth="1.8"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </div>
      )}

      <p className="border-t border-border px-5 py-3 text-[11px] text-text-muted" suppressHydrationWarning>
        Создан {new Date(deposit.createdAt).toLocaleString(locale === 'az' ? 'az-AZ' : 'ru-RU')}
      </p>
    </div>
  );
}
