'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@chcgreen/ui';
import { authApi } from '@/lib/api/auth';

export interface LogoutButtonProps {
  /** Куда редиректить после выхода. По умолчанию — '/'. */
  redirectTo?: string;
}

export function LogoutButton({ redirectTo = '/' }: LogoutButtonProps): JSX.Element {
  const t = useTranslations('common');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleLogout = (): void => {
    startTransition(async () => {
      try {
        await authApi.logout();
      } finally {
        router.push(redirectTo);
        router.refresh();
      }
    });
  };

  return (
    <Button variant="ghost" size="sm" loading={isPending} onClick={handleLogout}>
      {t('logout')}
    </Button>
  );
}
