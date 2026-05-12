import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { ChatLayout } from '@/features/chat/components/ChatLayout';
import { CodePurchaseForm } from '@/features/code-purchases/components/CodePurchaseForm';
import { getServerUser } from '@/lib/api/server';
import { apiFetch } from '@/lib/api/client';
import type { WalletBalanceDto } from '@/lib/api/wallet';

interface ChatPageProps {
  params: { locale: string };
  searchParams: { ticket?: string };
}

export async function generateMetadata({ params }: ChatPageProps): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'chat' });
  return { title: t('pageTitle') };
}

export default async function ChatPage({ params, searchParams }: ChatPageProps): Promise<JSX.Element> {
  const user = await getServerUser();
  if (!user) {
    const prefix = params.locale === 'ru' ? '' : `/${params.locale}`;
    redirect(`${prefix}/login`);
  }

  const cookieHeader = cookies()
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  const balance = await apiFetch<WalletBalanceDto>('/wallet/balance', {
    headers: { Cookie: cookieHeader },
  });

  const t = await getTranslations({ locale: params.locale, namespace: 'chat' });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <SiteHeader locale={params.locale} />
      <h1 className="mt-8 text-2xl font-bold text-text-primary">{t('pageTitle')}</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <ChatLayout locale={params.locale} viewerId={user!.id} initialTicketId={searchParams.ticket ?? null} />
        <aside>
          <CodePurchaseForm locale={params.locale} balanceMinor={balance.balanceMinor} />
        </aside>
      </div>
    </main>
  );
}
