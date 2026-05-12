import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { LoginForm } from '@/features/auth/components/LoginForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: t('login.title') };
}

export default async function LoginPage({
  params,
}: {
  params: { locale: string };
}): Promise<JSX.Element> {
  const t = await getTranslations('auth');
  return (
    <AuthCard
      title={t('login.title')}
      subtitle={t('login.subtitle')}
      footer={
        <span>
          {t('login.noAccount')}{' '}
          <Link href={`/${params.locale}/register`} className="text-brand hover:underline">
            {t('actions.register')}
          </Link>
        </span>
      }
    >
      <LoginForm onSuccessRedirect={`/${params.locale}`} />
    </AuthCard>
  );
}
