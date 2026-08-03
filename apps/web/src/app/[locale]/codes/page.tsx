import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { AppShell } from '@/components/layout/AppShell';
import { CodeShop } from '@/features/code-shop/components/CodeShop';
import { getServerUser } from '@/lib/api/server';
import { codeShopApi, type PurchasedCodeDto } from '@/lib/api/code-shop';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Покупка кода' };

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
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-xl ring-1 ring-brand/25"
        >
          🎟️
        </span>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Покупка кода</h1>
          <p className="text-sm text-text-secondary">
            Выберите номинал — код придёт мгновенно
          </p>
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
        Вывод средств из казино по-прежнему оформляется через чат с поддержкой —
        напишите оператору, и он поможет.
      </p>
    </AppShell>
  );
}
