import { redirect } from 'next/navigation';
import { adminApi } from '../../../lib/api/admin';
import { cookieHeaderFromRequest, getServerUser, isSuperAdmin } from '../../../lib/api/server';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Alert } from '../../../components/ui/Alert';
import { SettingsTable } from './SettingsTable';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const me = await getServerUser();
  if (!isSuperAdmin(me)) {
    redirect('/dashboard');
  }
  const cookie = cookieHeaderFromRequest();
  const res = await adminApi.settings.list({ cookie });

  return (
    <>
      <PageHeader
        title="Настройки"
        subtitle="Фиче-флаги, лимиты и параметры реферальной программы"
      />
      <Alert tone="info" className="mb-4">
        Изменения применяются ко всем инстансам после ~1 минуты (TTL кэша). Каждое изменение
        фиксируется в audit-log.
      </Alert>
      <SettingsTable initialItems={res.items} />
    </>
  );
}
