import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/layout/AppShell';
import { TicketIcon } from '@/components/icons';
import { ScratchCard } from '@/features/lottery/components/ScratchCard';
import { getServerUser } from '@/lib/api/server';
import { getPublicSettings } from '@/lib/api/settings';
import { lotteryApi } from '@/lib/api/lottery';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'lottery' });
  return { title: t('title') };
}

export default async function LotteryPage({
  params,
}: {
  params: { locale: string };
}): Promise<JSX.Element> {
  const cookieHeader = cookies()
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  const [user, settings, info, t] = await Promise.all([
    getServerUser(),
    getPublicSettings(),
    lotteryApi.info(cookieHeader).catch(() => null),
    getTranslations({ locale: params.locale, namespace: 'lottery' }),
  ]);

  if (!info || (settings['gameplay.lottery_enabled'] ?? true) === false) notFound();

  return (
    <AppShell locale={params.locale}>
      {/* На телефоне заголовок съедает первый экран — поле начинается сразу */}
      <div className="hidden items-center gap-3 sm:flex">
        <span
          aria-hidden
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning/10 text-warning ring-1 ring-warning/25"
        >
          <TicketIcon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('title')}</h1>
          <p className="text-sm text-text-secondary">{t('subtitle')}</p>
        </div>
      </div>

      <div className="sm:mt-6">
        <ScratchCard info={info} isAuthed={Boolean(user)} locale={params.locale} />
      </div>
    </AppShell>
  );
}
