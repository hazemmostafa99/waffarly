import { useQuery } from '@tanstack/react-query';
import type { CursorPage, PosEmployeeSession, StockBalance } from '@waffarly/contracts';
import { Input, useLocale } from '@waffarly/ui';
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { usePosWorkspaceStore } from '../../app/pos-workspace-store.js';
import { PosButton } from '../../components/pos-button.js';
import { apiRequest } from '../../lib/api-client.js';

export function EmployeeInventoryScreen() {
  const { employee } = useOutletContext<{ employee: PosEmployeeSession }>();
  const { locale, errorText, formatNumber } = useLocale();
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const workspace = usePosWorkspaceStore((state) => state.workspace);
  const selectBranch = usePosWorkspaceStore((state) => state.selectBranch);
  const branchId =
    employee.branches.find((branch) => branch.id === workspace?.selectedBranchId)?.id ??
    employee.branches[0]?.id ??
    '';
  const [search, setSearch] = useState('');
  const [cursors, setCursors] = useState<Array<string | undefined>>([]);
  const cursor = cursors.at(-1);
  const query = useQuery({
    queryKey: ['pos', employee.merchantId, employee.id, 'inventory', branchId, search, cursor],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ branchId, search, limit: '25' });
      if (cursor) params.set('cursor', cursor);
      return apiRequest<CursorPage<StockBalance>>(`/pos/inventory/balances?${params}`, { signal });
    },
    enabled: Boolean(branchId),
  });

  return (
    <section className="space-y-5 p-4 md:p-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{text('Stock balances', 'أرصدة المخزون')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {text(
              'Read-only stock balances for your assigned branches.',
              'عرض أرصدة المخزون للفروع المعيّنة لك فقط.',
            )}
          </p>
        </div>
        <label className="grid gap-1 text-sm">
          {text('Branch', 'الفرع')}
          <select
            className="min-h-11 rounded-lg border border-border bg-card px-3"
            value={branchId}
            onChange={(event) => {
              setCursors([]);
              selectBranch(employee.merchantId, employee.id, event.target.value);
            }}
          >
            {employee.branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
      </header>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid flex-1 gap-1 text-sm">
          {text('Search stock or warehouse', 'بحث عن صنف أو مخزن')}
          <Input
            value={search}
            maxLength={160}
            onChange={(event) => {
              setSearch(event.target.value);
              setCursors([]);
            }}
          />
        </label>
        <PosButton
          type="button"
          variant="outline"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {text('Refresh', 'تحديث')}
        </PosButton>
      </div>
      {query.isPending && <p role="status">{text('Loading balances…', 'جارٍ تحميل الأرصدة…')}</p>}
      {query.error && (
        <p role="alert" className="text-destructive">
          {errorText(query.error.message)}
        </p>
      )}
      {!query.isPending && !query.error && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-start text-sm">
            <thead>
              <tr>
                {[
                  text('Stock item', 'الصنف'),
                  text('Warehouse', 'المخزن'),
                  text('Condition', 'الحالة'),
                  text('Quantity', 'الكمية'),
                  text('Unit', 'الوحدة'),
                ].map((label) => (
                  <th key={label} className="p-3 text-start">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {query.data?.items.map((balance) => (
                <tr key={balance.id} className="border-t border-border">
                  <td className="p-3">{balance.stockItemName}</td>
                  <td className="p-3">{balance.warehouseName}</td>
                  <td className="p-3">
                    {balance.condition === 'available'
                      ? text('Sellable', 'صالح للبيع')
                      : text('Non-sellable', 'غير صالح للبيع')}
                  </td>
                  <td className="p-3">
                    {formatNumber(Number(balance.quantity), { maximumFractionDigits: 6 })}
                  </td>
                  <td className="p-3">{balance.baseUnit}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {query.data?.items.length === 0 && (
            <p className="p-4" role="status">
              {text('No stock balances found.', 'لا توجد أرصدة مطابقة.')}
            </p>
          )}
        </div>
      )}
      <div className="flex gap-3">
        <PosButton
          type="button"
          variant="outline"
          disabled={cursors.length === 0 || query.isFetching}
          onClick={() => setCursors((current) => current.slice(0, -1))}
        >
          {text('Previous', 'السابق')}
        </PosButton>
        <PosButton
          type="button"
          variant="outline"
          disabled={!query.data?.nextCursor || query.isFetching || query.isError}
          onClick={() => setCursors((current) => [...current, query.data?.nextCursor ?? undefined])}
        >
          {text('Next', 'التالي')}
        </PosButton>
      </div>
    </section>
  );
}
