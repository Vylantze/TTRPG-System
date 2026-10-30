import { Fragment, useState, type ReactNode } from 'react';
import type { DataTableColumn } from '@/ui/src/types/DataTableColumn';

const cellClass = (column: { secondary?: boolean; className?: string }) =>
  [column.secondary && 'secondary', column.className].filter(Boolean).join(' ') || undefined;

/** Hairline table whose rows can open in place to show more detail. */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  detail,
  empty,
  label,
  sort: controlledSort,
  onSort,
}: {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  detail?: (row: Row) => ReactNode;
  empty: string;
  label: string;
  /** When given, sorting is controlled by the caller (for example kept in the URL). */
  sort?: { key: string; direction: 1 | -1 };
  onSort?: (sort: { key: string; direction: 1 | -1 }) => void;
}) {
  const [open, setOpen] = useState(new Set<string>());
  const [localSort, setLocalSort] = useState<{ key: string; direction: 1 | -1 }>();
  const sort = controlledSort ?? localSort;
  const setSort = onSort ?? setLocalSort;
  const sortColumn = columns.find((column) => column.key === sort?.key);
  const sorted = sortColumn?.sortValue
    ? [...rows].sort((a, b) => {
        const left = sortColumn.sortValue!(a),
          right = sortColumn.sortValue!(b);
        return (
          (typeof left === 'number' && typeof right === 'number'
            ? left - right
            : String(left).localeCompare(String(right))) * sort!.direction
        );
      })
    : rows;
  const toggle = (key: string) => {
    const next = new Set(open);
    if (!next.delete(key)) next.add(key);
    setOpen(next);
  };
  if (!rows.length) return <p className="muted table-empty">{empty}</p>;
  return (
    <div className="data-table-wrap">
      <table
        className="data-table"
        aria-label={label}
      >
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={cellClass(column)}
                aria-sort={sort?.key === column.key
                  ? sort.direction === 1
                    ? 'ascending'
                    : 'descending'
                  : undefined}
              >
                {column.sortValue
                  ? (
                      <button
                        className="sort-button"
                        onClick={() =>
                          setSort(sort?.key === column.key
                            ? { key: column.key, direction: sort.direction === 1 ? -1 : 1 }
                            : { key: column.key, direction: 1 })}
                      >
                        {column.header}
                        <span aria-hidden="true">
                          {sort?.key === column.key ? (sort.direction === 1 ? ' ▲' : ' ▼') : ''}
                        </span>
                      </button>
                    )
                  : column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const key = rowKey(row);
            const expanded = open.has(key);
            return (
              <Fragment key={key}>
                <tr className={expanded ? 'expanded' : undefined}>
                  {columns.map((column, index) => (
                    <td
                      key={column.key}
                      className={cellClass(column)}
                    >
                      {index === 0 && detail
                        ? (
                            <span className="row-head">
                              <button
                                className="row-toggle"
                                aria-expanded={expanded}
                                aria-label={expanded ? 'Hide details' : 'Show details'}
                                onClick={() => toggle(key)}
                              />
                              {column.cell(row)}
                            </span>
                          )
                        : column.cell(row)}
                    </td>
                  ))}
                </tr>
                {expanded && detail && (
                  <tr className="detail-row">
                    <td colSpan={columns.length}>{detail(row)}</td>
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
