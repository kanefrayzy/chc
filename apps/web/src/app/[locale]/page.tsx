import { AppShell } from '@/components/layout/AppShell';
import { Hero } from '@/components/landing/Hero';
import { GameTiles } from '@/components/landing/GameTiles';
import { FeaturesFooter, type FeatureItem } from '@/components/landing/FeaturesFooter';
import { RecentWinners } from '@/components/landing/RecentWinners';
import { TelegramBanner } from '@/components/landing/TelegramBanner';
import { getServerUser } from '@/lib/api/server';
import { getPublicSettings } from '@/lib/api/settings';

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
  const [user, settings] = await Promise.all([getServerUser(), getPublicSettings()]);
  const isAuthed = Boolean(user);
  const telegramUrl = settings['brand.social_telegram'] || '';
  const telegramLabel = settings['brand.social_telegram_label'] || '';

  return (
    <AppShell locale={params.locale}>
      <Hero locale={params.locale} isAuthed={isAuthed} />

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <GameTiles locale={params.locale} />
        </div>
        <RecentWinners locale={params.locale} />
      </div>

      <TelegramBanner href={telegramUrl} label={telegramLabel} />

      <FeaturesFooter items={FEATURES} />
    </AppShell>
  );
}
