import type { ReactNode } from 'react';

export interface DataTableColumn<Row> {
  key: string;
  header: string;
  cell: (row: Row) => ReactNode;
  /** Present when the column can be sorted from its header. */
  sortValue?: (row: Row) => string | number;
  /** Dropped below the table's narrow breakpoint; the expanded row still shows the detail. */
  secondary?: boolean;
  className?: string;
}
