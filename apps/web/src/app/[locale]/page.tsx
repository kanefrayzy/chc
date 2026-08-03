import { AppShell } from '@/components/layout/AppShell';
import { Hero } from '@/components/landing/Hero';
import { GameTiles } from '@/components/landing/GameTiles';
import { FeaturesFooter, type FeatureItem } from '@/components/landing/FeaturesFooter';
import { RecentWinners } from '@/components/landing/RecentWinners';
import { TelegramBanner } from '@/components/landing/TelegramBanner';
import { ProgressiveJackpot } from '@/components/landing/ProgressiveJackpot';
import { LastBigWin } from '@/components/landing/LastBigWin';
import { getServerUser } from '@/lib/api/server';
import { getPublicSettings } from '@/lib/api/settings';
import { progressiveApi } from '@/lib/api/progressive';

export const dynamic = 'force-dynamic';

const FEATURES: readonly FeatureItem[] = [
  { key: 'fair' },
  { key: 'fast' },
  { key: 'support' },
  { key: 'ssl' },
] as const;

export default async function HomePage({
  params,
}: {
  params: { locale: string };
}): Promise<JSX.Element> {
  const [user, settings, jackpots] = await Promise.all([
    getServerUser(),
    getPublicSettings(),
    // Витрина не должна ронять главную, если джекпот недоступен
    progressiveApi.list().catch(() => ({ items: [] })),
  ]);
  const isAuthed = Boolean(user);
  const telegramUrl = settings['brand.social_telegram'] || '';
  const telegramLabel = settings['brand.social_telegram_label'] || '';

  return (
    <AppShell locale={params.locale}>
      <Hero locale={params.locale} isAuthed={isAuthed} />

      <ProgressiveJackpot initialItems={jackpots.items} />
      <LastBigWin locale={params.locale} />

      <GameTiles locale={params.locale} />

      <RecentWinners locale={params.locale} />

      <TelegramBanner href={telegramUrl} label={telegramLabel} />

      <FeaturesFooter items={FEATURES} />
    </AppShell>
  );
}
