import { SiteHeader } from '@/components/layout/SiteHeader';
import { Hero } from '@/components/landing/Hero';
import { StatsGrid, type StatItem } from '@/components/landing/StatsGrid';
import { FeaturesFooter, type FeatureItem } from '@/components/landing/FeaturesFooter';

export const dynamic = 'force-dynamic';

const STATS: readonly StatItem[] = [
  { value: '12 856', labelKey: 'playersOnline' },
  { value: '35 210', labelKey: 'gamesPlayed' },
  { value: '₼ 273 645.50', labelKey: 'totalWon' },
  { value: '₼ 72 540.00', labelKey: 'paidToday' },
] as const;

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
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <SiteHeader locale={params.locale} />
      <Hero locale={params.locale} />
      <StatsGrid items={STATS} />
      <FeaturesFooter items={FEATURES} />
    </main>
  );
}
