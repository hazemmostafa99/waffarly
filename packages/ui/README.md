# Shared dashboard components

Import the styles once in the application's entry point:

```tsx
import '@waffarly/ui/dashboard-components.css';
```

`DashboardCard` provides a titled panel with optional description and header action. `SummaryCard` provides a metric, icon, detail, and `cream`, `mint`, `blue`, or `rose` tone. Both inherit the application's font and text direction.

`DataTable<T>` accepts typed column renderers, rows, stable row keys, an accessible caption, and loading/empty states. It scrolls inside its container on narrow screens. Selection, sorting, and row actions are composed through columns so the component can support different data models.

```tsx
import { DashboardCard, DataTable, Pagination, SummaryCard } from '@waffarly/ui';
import type { DataTableColumn } from '@waffarly/ui';

type Customer = { id: string; name: string };
const columns: DataTableColumn<Customer>[] = [
  { id: 'name', header: 'Customer', cell: (customer) => customer.name },
];

<SummaryCard label="Customers" value={customers.length} tone="mint" />;
<DashboardCard title="Customers" action={<button>Add customer</button>}>
  <DataTable
    columns={columns}
    rows={visibleCustomers}
    rowKey={(customer) => customer.id}
    caption="Customers"
    loading={loading}
    loadingState="Loading customers…"
    emptyState="No customers yet."
  />
  <Pagination
    page={page}
    pageSize={10}
    total={customers.length}
    onPageChange={setPage}
    label="Customer pages"
    pageLabel={(value) => `Page ${value}`}
    previousLabel="Previous page"
    nextLabel="Next page"
    summary={(start, end, total) => `${start}–${end} of ${total}`}
  />
</DashboardCard>;
```

`Pagination` is controlled: the caller filters and slices the data and resets the page when filters change. It clamps page bounds and uses a compact window for large datasets. Supply localized labels and summary text; `aria-current` identifies the active page. See the merchant dashboard's `ProductsPage.tsx` for an Arabic/English example with filters, selection, and bulk actions.
