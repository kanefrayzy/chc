import { Fragment, type ReactNode } from 'react';
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
  renderDetail,
}: {
  rows: T[];
  columns: Column<T>[];
  empty?: ReactNode;
  className?: string;
  /** Разворачиваемая строка под записью: вернуть null, если раскрывать нечего. */
  renderDetail?: (row: T) => ReactNode;
}) {
  if (rows.length === 0) {
    return (
      <div className="py-16 text-center">
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
          {rows.map((row) => {
            const detail = renderDetail?.(row) ?? null;
            return (
              <Fragment key={row.id}>
                <tr className="hover:bg-elevated/70 transition-colors bg-surface">
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
                {detail && (
                  <tr className="bg-elevated/40">
                    <td colSpan={columns.length} className="px-4 pb-4 pt-0">
                      {detail}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
