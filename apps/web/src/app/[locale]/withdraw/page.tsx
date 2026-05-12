import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { WithdrawForm } from '@/features/withdrawals/components/WithdrawForm';
import { WithdrawalsList } from '@/features/withdrawals/components/WithdrawalsList';
import { getServerUser } from '@/lib/api/server';
import { apiFetch } from '@/lib/api/client';
import type { WalletBalanceDto } from '@/lib/api/wallet';

interface WithdrawPageProps {
  params: { locale: string };
}

export async function generateMetadata({ params }: WithdrawPageProps): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'withdraw' });
  return { title: t('pageTitle') };
}

export default async function WithdrawPage({ params }: WithdrawPageProps): Promise<JSX.Element> {
  const user = await getServerUser();
  if (!user) {
    const prefix = params.locale === 'ru' ? '' : `/${params.locale}`;
    redirect(`${prefix}/login`);
  }

  const cookieHeader = cookies()
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  const balance = await apiFetch<WalletBalanceDto>('/wallet/balance', {
    headers: { Cookie: cookieHeader },
  });

  const t = await getTranslations({ locale: params.locale, namespace: 'withdraw' });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <SiteHeader locale={params.locale} />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <WithdrawForm balanceMinor={balance.balanceMinor} />
        <section>
          <h2 className="mb-4 text-lg font-semibold text-text-primary">{t('historyTitle')}</h2>
          <WithdrawalsList locale={params.locale} />
        </section>
      </div>
    </main>
  );
}
