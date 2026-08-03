import { adminApi } from '../../../lib/api/admin';
import { cookieHeaderFromRequest } from '../../../lib/api/server';
import { PageHeader } from '../../../components/ui/PageHeader';
import { CodeShopManager } from './CodeShopManager';

export const dynamic = 'force-dynamic';

export default async function CodeShopPage() {
  const cookie = cookieHeaderFromRequest();
  const [products, sales] = await Promise.all([
    adminApi.codeShop.products({ cookie }),
    adminApi.codeShop.sales({ limit: 30 }, { cookie }).catch(() => ({ items: [], nextCursor: null })),
  ]);

  return (
    <>
      <PageHeader
        title="Магазин кодов"
        subtitle="Номиналы, склад кодов и продажи"
      />
      <CodeShopManager initialProducts={products.items} initialSales={sales.items} />
    </>
  );
}
