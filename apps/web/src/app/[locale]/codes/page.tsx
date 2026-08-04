import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/layout/AppShell';
import { TicketIcon } from '@/components/icons';
import { CodeShop } from '@/features/code-shop/components/CodeShop';
import { getServerUser } from '@/lib/api/server';
import { codeShopApi, type PurchasedCodeDto } from '@/lib/api/code-shop';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'codeShop' });
  return { title: t('title') };
}

export default async function CodesPage({
  params,
}: {
  params: { locale: string };
}): Promise<JSX.Element> {
  const user = await getServerUser();
  const cookieHeader = cookies()
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  const t = await getTranslations({ locale: params.locale, namespace: 'codeShop' });

  const [products, history] = await Promise.all([
    codeShopApi.products(cookieHeader).catch(() => ({ items: [] })),
    user
      ? codeShopApi
          .history({ limit: 20, cookieHeader })
          .catch(() => ({ items: [] as PurchasedCodeDto[], nextCursor: null }))
      : Promise.resolve({ items: [] as PurchasedCodeDto[], nextCursor: null }),
  ]);

  return (
    <AppShell locale={params.locale}>
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/25"
        >
          <TicketIcon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('title')}</h1>
          <p className="text-sm text-text-secondary">{t('subtitle')}</p>
        </div>
      </div>

      <div className="mt-6">
        <CodeShop
          initialProducts={products.items}
          initialHistory={history.items}
          isAuthed={Boolean(user)}
          locale={params.locale}
        />
      </div>

      <p className="mt-6 rounded-xl border border-border bg-bg-card px-4 py-3 text-xs leading-relaxed text-text-muted">
        {t('withdrawNote')}
      </p>
    </AppShell>
  );
}
