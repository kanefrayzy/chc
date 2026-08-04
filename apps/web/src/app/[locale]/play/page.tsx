import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { PlayPage } from '@/features/code-purchases/components/PlayPage';
import { getServerUser } from '@/lib/api/server';
import { getPublicSettings } from '@/lib/api/settings';
import { localePrefix } from '@/lib/i18n/prefix';

interface PlayRouteProps {
  params: { locale: string };
}

export const metadata: Metadata = {
  title: 'Ввести код',
};

export default async function PlayRoute({ params }: PlayRouteProps): Promise<JSX.Element> {
  const user = await getServerUser();
  if (!user) {
    const prefix = localePrefix(params.locale);
    redirect(`${prefix}/login`);
  }

  const settings = await getPublicSettings();
  const casinoUrl = settings['gameplay.external_casino_url'] ?? '';

  return (
    <AppShell locale={params.locale}>
      <PlayPage casinoUrl={casinoUrl} />
    </AppShell>
  );
}
