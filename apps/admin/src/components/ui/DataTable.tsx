import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  width?: string;
  align?: 'left' | 'right' | 'center';
}

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  empty,
  className,
}: {
  rows: T[];
  columns: Column<T>[];
  empty?: ReactNode;
  className?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-sm text-ink-500">
        {empty ?? 'Нет записей'}
      </div>
    );
  }
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-sm">
        <thead className="bg-page text-xs uppercase tracking-wide text-ink-500">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={c.width ? { width: c.width } : undefined}
                className={cn(
                  'px-4 py-2.5 font-semibold border-b border-border',
                  c.align === 'right' && 'text-right',
                  c.align === 'center' && 'text-center',
                  (!c.align || c.align === 'left') && 'text-left',
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-page/60 transition-colors">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    'px-4 py-3 border-b border-border align-middle',
                    c.align === 'right' && 'text-right',
                    c.align === 'center' && 'text-center',
                  )}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
