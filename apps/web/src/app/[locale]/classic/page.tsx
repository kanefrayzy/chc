import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/layout/AppShell';
import { ClassicLayout } from '@/features/classic/components/ClassicLayout';
import { getServerUser } from '@/lib/api/server';
import { apiFetch } from '@/lib/api/client';
import { getPublicSettings } from '@/lib/api/settings';
import type { WalletBalanceDto } from '@/lib/api/wallet';
import type {
  ClassicLimitsDto,
  ClassicRoundDto,
  ClassicStateDto,
} from '@/lib/api/classic';

interface ClassicPageProps {
  params: { locale: string };
}

export async function generateMetadata({ params }: ClassicPageProps): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'classic' });
  return { title: t('pageTitle') };
}

export default async function ClassicPage({ params }: ClassicPageProps): Promise<JSX.Element> {
  const user = await getServerUser();

  const cookieHeader = cookies()
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  let balanceMinor: string | null = null;
  if (user) {
    try {
      const balance = await apiFetch<WalletBalanceDto>('/wallet/balance', {
        headers: { Cookie: cookieHeader },
      });
      balanceMinor = balance.balanceMinor;
    } catch {
      balanceMinor = null;
    }
  }

  const settings = await getPublicSettings();
  const defaultLimits: ClassicLimitsDto = {
    minBetMinor: settings['classic.min_bet_minor'] ?? '100',
    maxBetMinor: settings['classic.max_bet_minor'] ?? '10000000',
    roundDurationSec: settings['classic.round_duration_sec'] ?? 30,
    rollingDurationSec: settings['classic.rolling_duration_sec'] ?? 8,
    minPlayersToStart: settings['classic.min_players_to_start'] ?? 2,
  };

  let initialRound: ClassicRoundDto | null = null;
  let initialHistory: ClassicRoundDto[] = [];
  let limits: ClassicLimitsDto = defaultLimits;
  try {
    const [state, fetchedLimits] = await Promise.all([
      apiFetch<ClassicStateDto>('/classic/state'),
      apiFetch<ClassicLimitsDto>('/classic/limits'),
    ]);
    initialRound = state.round ?? null;
    limits = fetchedLimits;
  } catch {
    /* */
  }
  try {
    const hist = await apiFetch<{ items: ClassicRoundDto[] }>('/classic/history?limit=15');
    initialHistory = hist.items;
  } catch {
    /* */
  }

  return (
    <AppShell locale={params.locale}>
      <ClassicLayout
        isAuthed={Boolean(user)}
        balanceMinor={balanceMinor}
        limits={limits}
        initialRound={initialRound}
        initialHistory={initialHistory}
        currentUserId={user?.id ?? null}
      />
    </AppShell>
  );
}
