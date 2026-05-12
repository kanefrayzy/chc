import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/layout/AppShell';
import { RouletteLayout } from '@/features/roulette/components/RouletteLayout';
import { getServerUser } from '@/lib/api/server';
import { apiFetch } from '@/lib/api/client';
import type { WalletBalanceDto } from '@/lib/api/wallet';

interface RoulettePageProps {
  params: { locale: string };
}

export async function generateMetadata({ params }: RoulettePageProps): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'roulette' });
  return { title: t('pageTitle') };
}

export default async function RoulettePage({ params }: RoulettePageProps): Promise<JSX.Element> {
  const user = await getServerUser();
  let balanceMinor: string | null = null;
  if (user) {
    const cookieHeader = cookies()
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');
    const balance = await apiFetch<WalletBalanceDto>('/wallet/balance', {
      headers: { Cookie: cookieHeader },
    });
    balanceMinor = balance.balanceMinor;
  }

  const t = await getTranslations({ locale: params.locale, namespace: 'roulette' });

  return (
    <AppShell locale={params.locale}>
      <h1 className="text-2xl font-bold text-text-primary">{t('pageTitle')}</h1>
      <p className="mt-1 text-sm text-text-secondary">{t('description')}</p>
      <div className="mt-6">
        <RouletteLayout
          isAuthed={Boolean(user)}
          balanceMinor={balanceMinor}
          locale={params.locale}
        />
      </div>
    </AppShell>
  );
}
