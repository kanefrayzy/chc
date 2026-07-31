import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { DepositPanel } from '@/features/wallet/components/DepositPanel';
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
    <AppShell locale={params.locale}>
      <h1 className="text-2xl font-bold text-text-primary">{t('pageTitle')}</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="h-fit rounded-2xl border border-border bg-bg-elevated p-5">
          <DepositPanel locale={params.locale} />
        </section>
        <section>
          <h2 className="mb-4 text-lg font-semibold text-text-primary">{t('historyTitle')}</h2>
          <DepositsList locale={params.locale} />
        </section>
      </div>
    </AppShell>
  );
}
