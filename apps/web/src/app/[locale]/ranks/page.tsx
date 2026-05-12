import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { RankList } from '@/features/ranks/components/RankList';
import { RankProgressCard } from '@/features/ranks/components/RankProgressCard';
import { getServerUser } from '@/lib/api/server';
import { ranksApi, type MyRankProgressDto } from '@/lib/api/ranks';

interface RanksPageProps {
  params: { locale: string };
}

export async function generateMetadata({ params }: RanksPageProps): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'ranks' });
  return { title: t('pageTitle') };
}

export default async function RanksPage({ params }: RanksPageProps): Promise<JSX.Element> {
  const user = await getServerUser();
  const cookieHeader = cookies()
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  const list = await ranksApi.list(user ? cookieHeader : undefined);
  let progress: MyRankProgressDto | null = null;
  if (user) {
    try {
      progress = await ranksApi.me(cookieHeader);
    } catch {
      progress = null;
    }
  }

  const t = await getTranslations({ locale: params.locale, namespace: 'ranks' });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <SiteHeader locale={params.locale} />
      <h1 className="mt-8 text-2xl font-bold text-text-primary">{t('pageTitle')}</h1>
      <p className="mt-1 text-sm text-text-secondary">{t('pageSubtitle')}</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <RankList
          ranks={list.items}
          locale={params.locale}
          currentRankId={progress?.current?.id ?? null}
          totalWageredMinor={progress?.totalWageredMinor}
        />
        {progress && (
          <aside>
            <RankProgressCard progress={progress} locale={params.locale} />
          </aside>
        )}
      </div>
    </main>
  );
}
