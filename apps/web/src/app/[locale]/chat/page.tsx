import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { ChatLayout } from '@/features/chat/components/ChatLayout';
import { CodePurchaseForm } from '@/features/code-purchases/components/CodePurchaseForm';
import { getServerUser } from '@/lib/api/server';

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

  const t = await getTranslations({ locale: params.locale, namespace: 'chat' });

  return (
    <AppShell locale={params.locale}>
      <h1 className="text-2xl font-bold text-text-primary">{t('pageTitle')}</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <ChatLayout locale={params.locale} viewerId={user!.id} initialTicketId={searchParams.ticket ?? null} />
        <aside>
          <CodePurchaseForm locale={params.locale} />
        </aside>
      </div>
    </AppShell>
  );
}
