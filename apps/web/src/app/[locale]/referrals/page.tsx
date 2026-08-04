import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { UsersIcon } from '@/components/icons';
import { ReferralDashboard } from '@/features/referrals/components/ReferralDashboard';
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

  const [summary, earnings, referrals] = await Promise.all([
    referralsApi.me(cookieHeader),
    referralsApi.earnings({ cookieHeader, limit: 20 }),
    referralsApi.list({ cookieHeader, limit: 50 }),
  ]);

  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const prefix = params.locale === 'ru' ? '' : `/${params.locale}`;
  const shareUrl = `${proto}://${host}${prefix}/register?ref=${summary.referralCode}`;

  const t = await getTranslations({ locale: params.locale, namespace: 'referrals' });

  return (
    <AppShell locale={params.locale}>
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/25"
        >
          <UsersIcon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('pageTitle')}</h1>
          <p className="text-sm text-text-secondary">{t('pageSubtitle')}</p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <ReferralDashboard
          summary={summary}
          referrals={referrals.items}
          shareUrl={shareUrl}
          locale={params.locale}
        />
        <EarningsSection
          locale={params.locale}
          initialItems={earnings.items}
          initialCursor={earnings.nextCursor}
        />
      </div>
    </AppShell>
  );
}
