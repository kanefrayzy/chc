import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { TicketIcon } from '@/components/icons';
import { ScratchCard } from '@/features/lottery/components/ScratchCard';
import { getServerUser } from '@/lib/api/server';
import { getPublicSettings } from '@/lib/api/settings';
import { lotteryApi } from '@/lib/api/lottery';

export const dynamic = 'force-dynamic';

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  return { title: params.locale === 'az' ? 'Poz Qazan' : 'Лотерея' };
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

  const [user, settings, info] = await Promise.all([
    getServerUser(),
    getPublicSettings(),
    lotteryApi.info(cookieHeader).catch(() => null),
  ]);

  if (!info || (settings['gameplay.lottery_enabled'] ?? true) === false) notFound();

  return (
    <AppShell locale={params.locale}>
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning/10 text-warning ring-1 ring-warning/25"
        >
          <TicketIcon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {params.locale === 'az' ? 'Poz Qazan' : 'Лотерея'}
          </h1>
          <p className="text-sm text-text-secondary">
            {params.locale === 'az'
              ? 'Üç eyni məbləği toplayın və mükafatı götürün'
              : 'Соберите три одинаковые суммы и заберите приз'}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <ScratchCard info={info} isAuthed={Boolean(user)} locale={params.locale} />
      </div>
    </AppShell>
  );
}
