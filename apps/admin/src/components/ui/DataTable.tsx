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
      <div className="py-16 text-center">
        <div className="text-3xl mb-2">📭</div>
        <div className="text-sm text-ink-400 font-medium">{empty ?? 'Нет записей'}</div>
      </div>
    );
  }
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((c) => (
              <th
                key={c.key}
                style={c.width ? { width: c.width } : undefined}
                className={cn(
                  'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-400 bg-elevated',
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
        <tbody className="divide-y divide-border">
          {rows.map((row, i) => (
            <tr
              key={row.id}
              className={cn(
                'hover:bg-elevated/70 transition-colors',
                i % 2 === 0 ? 'bg-surface' : 'bg-surface',
              )}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    'px-4 py-3.5 align-middle',
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
