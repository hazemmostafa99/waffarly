import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, DataTable, Input, useLocale, type DataTableColumn } from '@waffarly/ui';
import type { InventoryBranch, OwnerProductProfitabilityReport, OwnerProductProfitabilityRow, OwnerProfitabilityDimensionRow } from '@waffarly/contracts';
import { InventoryHeader } from '../inventory/InventoryHeader.js';
import { InventoryCard } from '../inventory/InventoryCard.js';
import { inventoryCopy } from '../inventory/inventory-copy.js';
import { apiRequest, apiRequestPage } from '../../lib/api-client.js';

type ProfitabilityDisplayRow = {
  rowId: string;
  displayName: string;
  quantitySold: number;
  quantityRefunded: number;
  revenue: string;
  refundRevenue: string;
  cost: string | null;
  grossProfit: string | null;
  marginPercent: number | null;
  salesLines: number;
  unknownCostLines: number;
};

function cairoDate(value: Date): string {
  return value.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
}

function cairoMonthStart(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(value);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return `${year}-${month}-01`;
}

export function ProductProfitabilityPage() {
  const { locale, t, errorText, formatDigits } = useLocale();
  const text = useCallback((value: string) => inventoryCopy(value, locale, t), [locale, t]);
  const now = new Date();
  const [from, setFrom] = useState(() => cairoMonthStart(now));
  const [to, setTo] = useState(() => cairoDate(now));
  const [branchId, setBranchId] = useState('');
  const [viewBy, setViewBy] = useState<'product' | 'menu' | 'branch'>('product');
  const [branches, setBranches] = useState<InventoryBranch[]>([]);
  const [report, setReport] = useState<OwnerProductProfitabilityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let current = true;
    void apiRequestPage<InventoryBranch>('/owner/inventory/branches?limit=100')
      .then((page) => current && setBranches(page.items.filter((branch) => !branch.archivedAt)))
      .catch(() => current && setBranches([]));
    return () => { current = false; };
  }, []);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ from, to, limit: '100' });
    if (branchId) params.set('branchId', branchId);
    void apiRequest<OwnerProductProfitabilityReport>(`/owner/reports/profitability/products?${params.toString()}`)
      .then((value) => current && setReport(value))
      .catch((cause: unknown) => {
        if (current) {
          setReport(null);
          setError(cause instanceof Error ? errorText(cause.message) : text('Could not load profitability report.'));
        }
      })
      .finally(() => current && setLoading(false));
    return () => { current = false; };
  }, [branchId, errorText, from, refresh, text, to]);

  const activeRows: ProfitabilityDisplayRow[] = useMemo(() => {
    const convertProduct = (row: OwnerProductProfitabilityRow): ProfitabilityDisplayRow => ({
      rowId: row.productId, displayName: row.productName, ...row,
    });
    const convertDimension = (row: OwnerProfitabilityDimensionRow): ProfitabilityDisplayRow => ({
      rowId: row.dimensionId, displayName: row.dimensionName,
      quantitySold: row.quantitySold, quantityRefunded: row.quantityRefunded,
      revenue: row.revenue, refundRevenue: row.refundRevenue, cost: row.cost,
      grossProfit: row.grossProfit, marginPercent: row.marginPercent,
      salesLines: row.salesLines, unknownCostLines: row.unknownCostLines,
    });
    if (viewBy === 'menu') return (report?.menuSections ?? []).map(convertDimension);
    if (viewBy === 'branch') return (report?.branches ?? []).map(convertDimension);
    return (report?.products ?? []).map(convertProduct);
  }, [report, viewBy]);

  const columns = useMemo<DataTableColumn<ProfitabilityDisplayRow>[]>(() => [
    { id: 'product', header: text(viewBy === 'product' ? 'Product' : viewBy === 'menu' ? 'Menu section' : 'Branch'), cell: (row) => <strong>{formatDigits(row.displayName)}</strong> },
    { id: 'quantity', header: text('Sold'), cell: (row) => formatDigits(String(row.quantitySold)) },
    { id: 'refundQuantity', header: text('Refunded'), cell: (row) => formatDigits(String(row.quantityRefunded)) },
    { id: 'revenue', header: text('Revenue'), cell: (row) => formatDigits(row.revenue) },
    { id: 'refund', header: text('Refund amount'), cell: (row) => formatDigits(row.refundRevenue) },
    { id: 'cost', header: text('Consumed cost'), cell: (row) => row.cost === null ? <Badge variant="warning">{text('Incomplete')}</Badge> : formatDigits(row.cost) },
    { id: 'profit', header: text('Gross profit'), cell: (row) => row.grossProfit === null ? <Badge variant="warning">{text('Incomplete')}</Badge> : <strong>{formatDigits(row.grossProfit)}</strong> },
    { id: 'margin', header: text('Margin'), cell: (row) => row.marginPercent === null ? row.unknownCostLines > 0 ? <Badge variant="warning">{text('Incomplete')}</Badge> : '—' : `${formatDigits(row.marginPercent.toFixed(2))}%` },
    { id: 'coverage', header: text('Cost status'), cell: (row) => row.unknownCostLines > 0 ? <Badge variant="warning">{text('Missing cost')}: {formatDigits(String(row.unknownCostLines))}</Badge> : <Badge variant="success">{text('Recorded')}</Badge> },
  ], [formatDigits, locale, t, viewBy]);

  function exportCsv() {
    if (!report) return;
    const csvRows = [
      [text(viewBy === 'product' ? 'Product' : viewBy === 'menu' ? 'Menu section' : 'Branch'), text('Quantity sold'), text('Quantity refunded'), text('Revenue'), text('Refund revenue'), text('Cost'), text('Gross profit'), text('Margin %'), text('Lines with missing cost')],
      ...activeRows.map((row) => [row.displayName, row.quantitySold, row.quantityRefunded, row.revenue, row.refundRevenue, row.cost ?? text('Incomplete'), row.grossProfit ?? text('Incomplete'), row.marginPercent ?? (row.unknownCostLines > 0 ? text('Incomplete') : ''), row.unknownCostLines]),
    ];
    const csv = `\uFEFF${csvRows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `product-profitability-${from}-${to}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="inventory-page product-profitability-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <InventoryHeader title={text('Product profitability')} description={text('Revenue recognized at sale or order acceptance, refunds attributed by item, and cost recorded at stock consumption.')} />
      <InventoryCard title={text('Product gross profit')} description={text('This is gross profit before rent, wages, utilities, payment fees, and other operating expenses.') }>
        <div className="inventory-filters">
          <label>{text('From')}<Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label>{text('To')}<Input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          <label>{text('Branch')}<select value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">{text('All branches')}</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{formatDigits(branch.name)}</option>)}</select></label>
          <label>{text('Group by')}<select value={viewBy} onChange={(event) => setViewBy(event.target.value as typeof viewBy)}><option value="product">{text('Product')}</option><option value="menu">{text('Menu section')}</option><option value="branch">{text('Branch')}</option></select></label>
          <Button type="button" variant="outline" onClick={() => setRefresh((value) => value + 1)} disabled={loading}>{text('Refresh')}</Button>
          <Button type="button" onClick={exportCsv} disabled={!report || loading}>{text('Export CSV')}</Button>
        </div>
        {report && (
          <div className="inventory-invoice-review-totals">
            <p><strong>{text('Revenue')}:</strong> {formatDigits(report.totals.revenue)}</p>
            <p><strong>{text('Refunds')}:</strong> {formatDigits(report.totals.refundRevenue)}</p>
            <p><strong>{text('Consumed cost')}:</strong> {report.totals.cost === null ? text('Incomplete') : formatDigits(report.totals.cost)}</p>
            <p><strong>{text('Gross profit')}:</strong> {report.totals.grossProfit === null ? text('Incomplete') : formatDigits(report.totals.grossProfit)}</p>
            <p><strong>{text('Margin')}:</strong> {report.totals.marginPercent === null ? report.totals.unknownCostLines > 0 ? text('Incomplete') : '—' : `${formatDigits(report.totals.marginPercent.toFixed(2))}%`}</p>
            <p><strong>{text('Lines with missing cost')}:</strong> {formatDigits(String(report.totals.unknownCostLines))}</p>
            <p><strong>{text('Unallocated refunds')}:</strong> {formatDigits(report.totals.unallocatedRefundAmount)} ({formatDigits(String(report.totals.unallocatedRefundCount))})</p>
          </div>
        )}
        {error && <p className="inventory-error" role="alert">{error}</p>}
        <p className="inventory-note">{text('Amounts are grouped by event date in Cairo time. Refunds without product lines are shown separately. Historical sales before cost tracking can appear with missing cost.')}</p>
        <p className="inventory-note">{text('Cost, gross profit, and margin are incomplete while any included line has unknown cost.')}</p>
        <DataTable
          columns={columns}
          rows={activeRows}
          rowKey={(row) => row.rowId}
          caption={text(viewBy === 'product' ? 'Product profitability' : viewBy === 'menu' ? 'Menu section profitability' : 'Branch profitability')}
          loading={loading}
          loadingState={text('Loading profitability report…')}
          emptyState={<div className="inventory-empty"><h3>{text(error ? 'Report is unavailable.' : 'No sales or cost events found.')}</h3></div>}
        />
        {report?.truncated && <p className="inventory-note">{text('Showing up to 100 rows. Complete profit rows come first; rows with missing cost follow. Narrow the dates or branch to view a smaller result set.')}</p>}
      </InventoryCard>
    </div>
  );
}
