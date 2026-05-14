import { AppShell } from '@/components/layout/AppShell';
import { Hero } from '@/components/landing/Hero';
import { GameTiles } from '@/components/landing/GameTiles';
import { FeaturesFooter, type FeatureItem } from '@/components/landing/FeaturesFooter';
import { RecentWinners } from '@/components/landing/RecentWinners';
import { getServerUser } from '@/lib/api/server';

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
  const user = await getServerUser();
  const isAuthed = Boolean(user);

  return (
    <AppShell locale={params.locale}>
      <Hero locale={params.locale} isAuthed={isAuthed} />

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <GameTiles locale={params.locale} />
        </div>
        <RecentWinners locale={params.locale} />
      </div>

      <FeaturesFooter items={FEATURES} />
    </AppShell>
  );
}
