'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useUi } from './ui-context';

/**
 * Возврат с платёжной страницы провайдера. Отдельных страниц /deposit и /withdraw
 * больше нет — провайдер возвращает игрока на главную с `?payment=success|fail`,
 * мы показываем уведомление, открываем кошелёк и убираем параметр из адреса.
 */
export function PaymentReturnHandler(): null {
  const t = useTranslations('deposit');
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { openDeposit, refreshBalance } = useUi();
  const handled = useRef(false);

  useEffect(() => {
    const status = params.get('payment');
    if (!status || handled.current) return;
    handled.current = true;

    if (status === 'success') {
      toast.success(t('form.paidPending'));
      refreshBalance();
    } else {
      toast.error(t('form.notCompleted'));
    }
    openDeposit();

    // Чистим адрес, чтобы уведомление не повторялось при обновлении страницы
    router.replace(pathname, { scroll: false });
  }, [params, pathname, router, openDeposit, refreshBalance]);

  return null;
}
