import { redirect } from 'next/navigation';
import { adminApi } from '../../../lib/api/admin';
import { cookieHeaderFromRequest, getServerUser, isSuperAdmin } from '../../../lib/api/server';
import { PageHeader } from '../../../components/ui/PageHeader';
import { PaymentMethodsPanel } from './PaymentMethodsPanel';

export const dynamic = 'force-dynamic';

export default async function PaymentMethodsPage() {
  const me = await getServerUser();
  if (!isSuperAdmin(me)) {
    redirect('/dashboard');
  }
  const cookie = cookieHeaderFromRequest();
  const res = await adminApi.paymentMethods.list({ cookie });

  return (
    <>
      <PageHeader
        title="Платёжные методы"
        subtitle="Создавайте обработчики на базе агрегаторов Betatransfer или Westwallet"
      />
      <PaymentMethodsPanel initialItems={res.items} />
    </>
  );
}
