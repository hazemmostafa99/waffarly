import type { Key, ReactNode } from 'react';
import { cn } from './utils.js';

export type DataTableColumn<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => Key;
  caption: string;
  emptyState: ReactNode;
  loading?: boolean;
  loadingState?: ReactNode;
  className?: string;
};

/** A semantic, horizontally scrollable table with caller-defined cells and states. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  emptyState,
  loading = false,
  loadingState = 'Loading…',
  className,
}: DataTableProps<T>) {
  return (
    <div
      className={cn('wf-table-scroll', className)}
      role="region"
      aria-label={caption}
      tabIndex={0}
    >
      <table className="wf-data-table" aria-busy={loading}>
        <caption className="wf-sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.id} scope="col" className={column.className}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading || rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="wf-table-state" role="status">
                {loading ? loadingState : emptyState}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td key={column.id} className={column.className}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
