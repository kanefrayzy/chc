import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { RegisterForm } from '@/features/auth/components/RegisterForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: t('register.title') };
}

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { ref?: string };
}): Promise<JSX.Element> {
  const t = await getTranslations('auth');
  return (
    <AuthCard
      title={t('register.title')}
      subtitle={t('register.subtitle')}
      footer={
        <span>
          {t('register.hasAccount')}{' '}
          <Link href={`/${params.locale}/login`} className="text-brand hover:underline">
            {t('actions.login')}
          </Link>
        </span>
      }
    >
      <RegisterForm
        initialReferralCode={searchParams.ref ?? ''}
        onSuccessRedirect={`/${params.locale}`}
      />
    </AuthCard>
  );
}
