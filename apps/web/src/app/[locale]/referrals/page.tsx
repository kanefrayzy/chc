import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { ReferralCodeCard } from '@/features/referrals/components/ReferralCodeCard';
import { ReferralStats } from '@/features/referrals/components/ReferralStats';
import { EarningsSection } from '@/features/referrals/components/EarningsSection';
import { getServerUser } from '@/lib/api/server';
import { referralsApi } from '@/lib/api/referrals';

interface ReferralsPageProps {
  params: { locale: string };
}

export async function generateMetadata({ params }: ReferralsPageProps): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'referrals' });
  return { title: t('pageTitle') };
}

export default async function ReferralsPage({ params }: ReferralsPageProps): Promise<JSX.Element> {
  const user = await getServerUser();
  if (!user) {
    const prefix = params.locale === 'ru' ? '' : `/${params.locale}`;
    redirect(`${prefix}/login`);
  }

  const cookieHeader = cookies()
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  const [summary, earnings] = await Promise.all([
    referralsApi.me(cookieHeader),
    referralsApi.earnings({ cookieHeader, limit: 20 }),
  ]);

  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const prefix = params.locale === 'ru' ? '' : `/${params.locale}`;
  const shareUrl = `${proto}://${host}${prefix}/register?ref=${summary.referralCode}`;

  const t = await getTranslations({ locale: params.locale, namespace: 'referrals' });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <SiteHeader locale={params.locale} />
      <h1 className="mt-8 text-2xl font-bold text-text-primary">{t('pageTitle')}</h1>
      <p className="mt-1 text-sm text-text-secondary">{t('pageSubtitle')}</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <ReferralCodeCard code={summary.referralCode} shareUrl={shareUrl} />
          <EarningsSection
            locale={params.locale}
            initialItems={earnings.items}
            initialCursor={earnings.nextCursor}
          />
        </div>
        <aside>
          <ReferralStats
            referralsCount={summary.referralsCount}
            totalEarningsMinor={summary.totalEarningsMinor}
          />
        </aside>
      </div>
    </main>
  );
}
