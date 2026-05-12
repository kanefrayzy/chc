'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@chcgreen/ui';
import { useUi } from './ui-context';

export function AuthButtons(): JSX.Element {
  const t = useTranslations('common');
  const { openAuth } = useUi();
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={() => openAuth('login')}>
        {t('login')}
      </Button>
      <Button variant="primary" size="sm" onClick={() => openAuth('register')}>
        {t('register')}
      </Button>
    </div>
  );
}
