import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { DepositForm } from '@/features/deposits/components/DepositForm';
import { DepositsList } from '@/features/deposits/components/DepositsList';
import { getServerUser } from '@/lib/api/server';

interface DepositPageProps {
  params: { locale: string };
}

export async function generateMetadata({ params }: DepositPageProps): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'deposit' });
  return { title: t('pageTitle') };
}

export default async function DepositPage({ params }: DepositPageProps): Promise<JSX.Element> {
  const user = await getServerUser();
  if (!user) {
    const prefix = params.locale === 'ru' ? '' : `/${params.locale}`;
    redirect(`${prefix}/login`);
  }
  const t = await getTranslations({ locale: params.locale, namespace: 'deposit' });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <SiteHeader locale={params.locale} />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <DepositForm locale={params.locale} />
        <section>
          <h2 className="mb-4 text-lg font-semibold text-text-primary">{t('historyTitle')}</h2>
          <DepositsList locale={params.locale} />
        </section>
      </div>
    </main>
  );
}
