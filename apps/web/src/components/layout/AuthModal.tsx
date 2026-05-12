'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn, Modal } from '@chcgreen/ui';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { RegisterForm } from '@/features/auth/components/RegisterForm';
import { useUi } from './ui-context';

export function AuthModal(): JSX.Element {
  const t = useTranslations('auth');
  const router = useRouter();
  const { authModalOpen, authModalTab, closeAuth, openAuth } = useUi();

  const handleSuccess = (): void => {
    closeAuth();
    router.refresh();
  };

  const tabBtn = (active: boolean): string =>
    cn(
      'flex-1 rounded-md py-2 text-sm font-semibold transition-colors',
      active
        ? 'bg-brand text-bg-base shadow-glow'
        : 'text-text-secondary hover:text-text-primary',
    );

  return (
    <Modal
      open={authModalOpen}
      onClose={closeAuth}
      size="md"
      title={authModalTab === 'login' ? t('login.title') : t('register.title')}
      description={authModalTab === 'login' ? t('login.subtitle') : t('register.subtitle')}
    >
      <div className="mb-5 flex gap-1 rounded-lg border border-border bg-bg-elevated p-1">
        <button
          type="button"
          className={tabBtn(authModalTab === 'login')}
          onClick={() => openAuth('login')}
        >
          {t('actions.login')}
        </button>
        <button
          type="button"
          className={tabBtn(authModalTab === 'register')}
          onClick={() => openAuth('register')}
        >
          {t('actions.register')}
        </button>
      </div>
      {authModalTab === 'login' ? (
        <LoginForm onSuccess={handleSuccess} />
      ) : (
        <RegisterForm onSuccess={handleSuccess} />
      )}
    </Modal>
  );
}
