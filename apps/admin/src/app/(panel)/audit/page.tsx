import { adminApi } from '../../../lib/api/admin';
import { cookieHeaderFromRequest } from '../../../lib/api/server';
import { formatDateTime, shortId } from '../../../lib/format';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { DataTable } from '../../../components/ui/DataTable';

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  const cookie = cookieHeaderFromRequest();
  const res = await adminApi.audit.list({ limit: 100 }, { cookie });

  return (
    <>
      <PageHeader
        title="Аудит-лог"
        subtitle="История действий администраторов и модераторов"
      />
      <Card>
        <DataTable
          rows={res.items}
          empty="Записей нет"
          columns={[
            {
              key: 'time',
              header: 'Время',
              cell: (r) => <span className="text-sm text-ink-500">{formatDateTime(r.createdAt)}</span>,
            },
            {
              key: 'actor',
              header: 'Кто',
              cell: (r) => (
                <div>
                  <div className="text-sm text-ink-900">{r.actorUsername ?? '—'}</div>
                  <div className="text-xs text-ink-400 font-mono">
                    {r.actorId ? shortId(r.actorId) : 'system'}
                  </div>
                </div>
              ),
            },
            {
              key: 'action',
              header: 'Действие',
              cell: (r) => <Badge tone="primary">{r.action}</Badge>,
            },
            {
              key: 'entity',
              header: 'Сущность',
              cell: (r) =>
                r.entityType ? (
                  <span className="text-sm text-ink-700">
                    {r.entityType}
                    {r.entityId ? <span className="text-ink-400 font-mono ml-1">{shortId(r.entityId)}</span> : null}
                  </span>
                ) : (
                  <span className="text-ink-400">—</span>
                ),
            },
            {
              key: 'payload',
              header: 'Подробности',
              cell: (r) =>
                r.payload ? (
                  <pre className="text-xs text-ink-700 font-mono max-w-[400px] overflow-x-auto">
                    {JSON.stringify(r.payload, null, 0)}
                  </pre>
                ) : (
                  <span className="text-ink-400">—</span>
                ),
            },
            {
              key: 'ip',
              header: 'IP',
              cell: (r) => <span className="text-xs font-mono text-ink-500">{r.ip ?? '—'}</span>,
            },
          ]}
        />
      </Card>
    </>
  );
}
