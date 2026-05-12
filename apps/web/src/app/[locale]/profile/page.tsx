import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getServerUser } from '@/lib/api/server';
import { AppShell } from '@/components/layout/AppShell';
import { ProfileHeader } from '@/features/profile/components/ProfileHeader';
import { ProfileTabs } from '@/features/profile/components/ProfileTabs';
import { ProfileOverviewPanel } from '@/features/profile/components/panels/ProfileOverviewPanel';
import { WalletPanel } from '@/features/profile/components/panels/WalletPanel';
import { ReferralsPanel } from '@/features/profile/components/panels/ReferralsPanel';
import { LogoutButton } from '@/features/auth/components/LogoutButton';

export const dynamic = 'force-dynamic';

interface ProfilePageProps {
  params: { locale: string };
}

export async function generateMetadata({ params }: ProfilePageProps) {
  const t = await getTranslations({ locale: params.locale, namespace: 'profile' });
  return { title: t('pageTitle') };
}

export default async function ProfilePage({ params }: ProfilePageProps): Promise<JSX.Element> {
  const user = await getServerUser();
  if (!user) {
    redirect(params.locale === 'ru' ? '/login' : `/${params.locale}/login`);
  }

  const t = await getTranslations({ locale: params.locale, namespace: 'profile' });

  return (
    <AppShell locale={params.locale}>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-text-primary">{t('pageTitle')}</h1>
        <LogoutButton redirectTo={params.locale === 'ru' ? '/' : `/${params.locale}`} />
      </div>
      <div className="mt-6 space-y-6">
        <ProfileHeader
          user={user}
          locale={params.locale}
          roleLabel={t('header.role')}
          referralLabel={t('header.referral')}
          memberSinceLabel={t('header.memberSince')}
        />
        <ProfileTabs
          tabs={[
            { id: 'overview', label: t('tabs.overview'), content: <ProfileOverviewPanel /> },
            {
              id: 'wallet',
              label: t('tabs.wallet'),
              content: <WalletPanel locale={params.locale} />,
            },
            {
              id: 'referrals',
              label: t('tabs.referrals'),
              content: <ReferralsPanel referralCode={user.referralCode} />,
            },
          ]}
        />
      </div>
    </AppShell>
  );
}
