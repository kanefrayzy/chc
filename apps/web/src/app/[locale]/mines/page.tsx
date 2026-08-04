import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/layout/AppShell';
import { MinesLayout } from '@/features/mines/components/MinesLayout';
import { getServerUser } from '@/lib/api/server';
import { apiFetch } from '@/lib/api/client';
import { getPublicSettings } from '@/lib/api/settings';
import type { WalletBalanceDto } from '@/lib/api/wallet';
import type { MinesLimitsDto } from '@/lib/api/mines';

interface MinesPageProps {
  params: { locale: string };
}

export async function generateMetadata({ params }: MinesPageProps): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'mines' });
  return { title: t('pageTitle') };
}

export default async function MinesPage({ params }: MinesPageProps): Promise<JSX.Element> {
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

  // Подтянем лимиты из публичных настроек (с дефолтами на случай отсутствия ключей).
  const settings = await getPublicSettings();
  const defaultLimits: MinesLimitsDto = {
    minBetMinor: settings['mines.min_bet_minor'] ?? '100',
    maxBetMinor: settings['mines.max_bet_minor'] ?? '100000',
    minMines: 1,
    maxMines: 24,
    totalTiles: 25,
  };

  return (
    <AppShell locale={params.locale}>
      <MinesLayout
        isAuthed={Boolean(user)}
        balanceMinor={balanceMinor}
        defaultLimits={defaultLimits}
        gemIconUrl={settings['mines.icon_url.gem'] || undefined}
        bombIconUrl={settings['mines.icon_url.bomb'] || undefined}
      />
    </AppShell>
  );
}
