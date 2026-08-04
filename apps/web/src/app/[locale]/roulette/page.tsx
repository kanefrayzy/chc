import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/layout/AppShell';
import { RouletteLayout } from '@/features/roulette/components/RouletteLayout';
import { getServerUser } from '@/lib/api/server';
import { apiFetch } from '@/lib/api/client';
import { getPublicSettings } from '@/lib/api/settings';
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
    try {
      const balance = await apiFetch<WalletBalanceDto>('/wallet/balance', {
        headers: { Cookie: cookieHeader },
      });
      balanceMinor = balance.balanceMinor;
    } catch {
      // Баланс не критичен для рендера: клиент подтянет его сокетом.
      // Раньше отказ здесь превращал всю страницу игры в ошибку.
      balanceMinor = null;
    }
  }

  const [t, settings] = await Promise.all([
    getTranslations({ locale: params.locale, namespace: 'roulette' }),
    getPublicSettings(),
  ]);

  return (
    <AppShell locale={params.locale}>
      <h1 className="text-2xl font-bold text-text-primary">{t('pageTitle')}</h1>
      <p className="mt-1 text-sm text-text-secondary">{t('description')}</p>
      <div className="mt-6">
        <RouletteLayout
          isAuthed={Boolean(user)}
          balanceMinor={balanceMinor}
          locale={params.locale}
          minBetMinor={settings['roulette.min_bet_minor']}
          maxBetMinor={settings['roulette.max_bet_minor']}
          iconGreen={settings['roulette.icon_url.green'] || undefined}
          iconRed={settings['roulette.icon_url.red'] || undefined}
          iconBlack={settings['roulette.icon_url.black'] || undefined}
        />
      </div>
    </AppShell>
  );
}
