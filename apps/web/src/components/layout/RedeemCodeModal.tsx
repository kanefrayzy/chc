'use client';

import { useState } from 'react';
import { Modal, Button, Alert } from '@chcgreen/ui';
import { toast } from 'sonner';
import { useUi } from './ui-context';

export interface RedeemCodeModalProps {
  isAuthed: boolean;
}

/**
 * Модалка активации купленного кода (для входа в стороннее казино).
 * Дизайн вдохновлён формой "Insert Code" из примера: одно крупное поле + кнопка.
 */
export function RedeemCodeModal({ isAuthed }: RedeemCodeModalProps): JSX.Element {
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
      setError('Код слишком короткий (минимум 14 цифр)');
      return;
    }
    if (clean.length > 14) {
      setError('Код слишком длинный (максимум 14 цифр)');
      return;
    }
    setLoading(true);
    // Симулируем проверку. Реальная активация — обычно редирект в стороннее казино.
    try {
      await new Promise((r) => setTimeout(r, 800));
      toast.success('Код принят. Сейчас откроем игровую сессию.');
      handleClose();
      // TODO: when real API is ready — redirect to external casino URL
    } catch {
      setError('Ошибка проверки кода. Попробуйте ещё раз.');
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
          <span
            aria-hidden
            className="flex h-7 w-7 items-center justify-center rounded-md bg-brand/15 text-brand"
          >
            🎫
          </span>
          <span>Ввод кода казино</span>
        </span>
      }
      description="Введите код, купленный в чате с модератором"
    >
      <div className="-mx-6 -my-5 bg-bg-elevated px-6 py-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="redeem-code" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-muted">
              Insert code
            </label>
            <input
              id="redeem-code"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(onlyDigits(e.target.value).slice(0, 14))}
              placeholder="•••• •••• •••• ••"
              maxLength={14}
              className="w-full rounded-xl border-2 border-border bg-bg-card px-4 py-4 text-center font-mono text-2xl tracking-[0.4em] text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              autoFocus
            />
            <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
              <span>14 цифр</span>
              <span className="font-mono">{code.length}/14</span>
            </div>
          </div>

          {error ? <Alert variant="danger">{error}</Alert> : null}

          <Button type="submit" variant="primary" size="lg" disabled={loading} fullWidth>
            {loading ? 'Проверяем…' : 'Активировать'}
          </Button>
        </form>

        <div className="mt-5 flex flex-col gap-2 rounded-xl border border-border bg-bg-card p-4 text-xs text-text-secondary">
          <div className="font-semibold text-text-primary">Нет кода?</div>
          <p>
            Код можно купить у модератора через чат поддержки.
            После оплаты модератор пришлёт 14-значный код, который вы вводите здесь.
          </p>
          <button
            type="button"
            onClick={buyNew}
            className="mt-1 self-start rounded-lg bg-brand/15 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/25"
          >
            💬 Купить код в чате
          </button>
        </div>
      </div>
    </Modal>
  );
}
