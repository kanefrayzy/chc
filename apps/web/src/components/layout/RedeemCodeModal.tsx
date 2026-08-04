'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Modal, Button, Alert } from '@chcgreen/ui';
import { toast } from 'sonner';
import { useUi } from './ui-context';
import { TicketIcon, ArrowRightIcon } from '@/components/icons';

export interface RedeemCodeModalProps {
  isAuthed: boolean;
}

/**
 * Модалка активации купленного кода (для входа в стороннее казино).
 * Дизайн вдохновлён формой "Insert Code" из примера: одно крупное поле + кнопка.
 */
export function RedeemCodeModal({ isAuthed }: RedeemCodeModalProps): JSX.Element {
  const t = useTranslations('redeem');
  const { redeemCodeModalOpen, closeRedeemCode, openAuth, toggleChat } = useUi();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onlyDigits = (s: string): string => s.replace(/\D+/g, '');

  function reset(): void {
    setCode('');
    setError(null);
    setLoading(false);
  }

  function handleClose(): void {
    closeRedeemCode();
    setTimeout(reset, 200);
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    const clean = onlyDigits(code);
    if (clean.length < 14) {
      setError(t('tooShort'));
      return;
    }
    if (clean.length > 14) {
      setError(t('tooLong'));
      return;
    }
    setLoading(true);
    // Симулируем проверку. Реальная активация — обычно редирект в стороннее казино.
    try {
      await new Promise((r) => setTimeout(r, 800));
      toast.success(t('accepted'));
      handleClose();
      // TODO: when real API is ready — redirect to external casino URL
    } catch {
      setError(t('checkFailed'));
    } finally {
      setLoading(false);
    }
  }

  function buyNew(): void {
    closeRedeemCode();
    if (!isAuthed) {
      openAuth('login');
      return;
    }
    toggleChat();
  }

  return (
    <Modal
      open={redeemCodeModalOpen}
      onClose={handleClose}
      size="md"
      title={
        <span className="flex items-center gap-2">
          <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-md bg-brand/15 text-brand">
            <TicketIcon className="h-4 w-4" />
          </span>
          <span>Insert Code</span>
        </span>
      }
    >
      <div className="-mx-6 -my-5 bg-bg-elevated px-6 py-6">
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            id="redeem-code"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(onlyDigits(e.target.value).slice(0, 14))}
            placeholder="•••• •••• •••• ••"
            maxLength={14}
            className="w-full rounded-lg border border-border bg-bg-card px-4 py-3 text-center font-mono text-xl tracking-[0.3em] text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            autoFocus
          />

          {error ? <Alert variant="danger">{error}</Alert> : null}

          <Button type="submit" variant="primary" size="lg" disabled={loading || code.length !== 14} fullWidth>
            {loading ? t('checking') : 'Ok'}
          </Button>

          <button
            type="button"
            onClick={buyNew}
            className="flex w-full items-center justify-center gap-1 text-center text-xs text-text-muted hover:text-brand underline-offset-2 hover:underline transition"
          >
            <span>{t('noCode')}</span>
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </Modal>
  );
}
