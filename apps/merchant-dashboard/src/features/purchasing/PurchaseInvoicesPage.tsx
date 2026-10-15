import {
  CursorPageControls as PageControls,
  type CursorPageState as PageState,
} from '../../components/CursorPageControls.js';
import { useEffect, useState, type FormEvent } from 'react';
import {
  Button,
  DashboardCard,
  DataTable,
  Input,
  useLocale,
  type DataTableColumn,
} from '@waffarly/ui';
import type {
  CreatePurchaseInvoiceRequest,
  PurchaseInvoice,
  PurchaseSupplier,
} from '@waffarly/contracts';
import { DashboardDialog } from '../../components/DashboardDialog.js';
import { apiRequest, apiRequestPage } from '../../lib/api-client.js';
import { inventoryCopy } from '../inventory/inventory-copy.js';
import { useNavigate } from 'react-router-dom';
import type { SupplierFields } from './purchasing.types.js';
import { SupplierEditor } from './SupplierEditor.js';
import { PurchaseInvoiceEditor } from './PurchaseInvoiceEditor.js';

type InvoiceEditorState = { invoice: PurchaseInvoice | null; key: string };
type SupplierEditorState = { supplier: PurchaseSupplier | null; key: string };

export function PurchaseInvoicesPage() {
  const { locale, t, errorText, formatDigits } = useLocale();
  const navigate = useNavigate();
  const text = (value: string) => inventoryCopy(value, locale, t);
  const [tab, setTab] = useState<'invoices' | 'suppliers'>('invoices');
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [invoiceStatus, setInvoiceStatus] = useState<'all' | 'draft' | 'confirmed'>('all');
  const [invoiceSearchDraft, setInvoiceSearchDraft] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoicePage, setInvoicePage] = useState<PageState>({});
  const [invoiceHistory, setInvoiceHistory] = useState<PageState[]>([]);
  const [invoiceNext, setInvoiceNext] = useState<string | null>(null);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<PurchaseSupplier[]>([]);
  const [supplierStatus, setSupplierStatus] = useState<'active' | 'archived' | 'all'>('active');
  const [supplierSearchDraft, setSupplierSearchDraft] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierPage, setSupplierPage] = useState<PageState>({});
  const [supplierHistory, setSupplierHistory] = useState<PageState[]>([]);
  const [supplierNext, setSupplierNext] = useState<string | null>(null);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [invoiceEditor, setInvoiceEditor] = useState<InvoiceEditorState | null>(null);
  const [supplierEditor, setSupplierEditor] = useState<SupplierEditorState | null>(null);
  const [invoiceReview, setInvoiceReview] = useState<PurchaseInvoice | null>(null);
  const [supplierArchive, setSupplierArchive] = useState<PurchaseSupplier | null>(null);
  const [confirmRequestIds, setConfirmRequestIds] = useState<Record<string, string>>({});

  useEffect(() => {
    let current = true;
    setInvoicesLoading(true);
    const query = new URLSearchParams({ limit: '25', status: invoiceStatus });
    if (invoiceSearch) query.set('search', invoiceSearch);
    if (invoicePage.cursor) query.set('cursor', invoicePage.cursor);
    void apiRequestPage<PurchaseInvoice>(`/owner/purchasing/invoices?${query.toString()}`)
      .then((page) => {
        if (!current) return;
        setInvoices(page.items);
        setInvoiceNext(page.nextCursor);
      })
      .catch((cause: unknown) => {
        if (current)
          setLoadError(
            cause instanceof Error
              ? errorText(cause.message)
              : text('Could not load purchase invoices.'),
          );
      })
      .finally(() => {
        if (current) setInvoicesLoading(false);
      });
    return () => {
      current = false;
    };
  }, [errorText, invoicePage, invoiceSearch, invoiceStatus, refreshKey]);

  useEffect(() => {
    let current = true;
    setSuppliersLoading(true);
    const query = new URLSearchParams({ limit: '25', status: supplierStatus });
    if (supplierSearch) query.set('search', supplierSearch);
    if (supplierPage.cursor) query.set('cursor', supplierPage.cursor);
    void apiRequestPage<PurchaseSupplier>(`/owner/purchasing/suppliers?${query.toString()}`)
      .then((page) => {
        if (!current) return;
        setSuppliers(page.items);
        setSupplierNext(page.nextCursor);
      })
      .catch((cause: unknown) => {
        if (current)
          setLoadError(
            cause instanceof Error ? errorText(cause.message) : text('Could not load suppliers.'),
          );
      })
      .finally(() => {
        if (current) setSuppliersLoading(false);
      });
    return () => {
      current = false;
    };
  }, [errorText, refreshKey, supplierPage, supplierSearch, supplierStatus]);

  const invoiceColumns: DataTableColumn<PurchaseInvoice>[] = [
    {
      id: 'reference',
      header: text('Invoice reference'),
      cell: (invoice) => (
        <div className="inventory-table-name">
          <strong>{formatDigits(invoice.supplierInvoiceNumber || invoice.id.slice(0, 8))}</strong>
          <small>{formatDigits(invoice.supplierName)}</small>
        </div>
      ),
    },
    {
      id: 'warehouse',
      header: text('Warehouse'),
      cell: (invoice) => formatDigits(`${invoice.branchName} · ${invoice.warehouseName}`),
    },
    {
      id: 'lines',
      header: text('Lines'),
      cell: (invoice) => formatDigits(String(invoice.lines.length)),
    },
    {
      id: 'status',
      header: text('Status'),
      cell: (invoice) => text(invoice.status === 'draft' ? 'Draft' : 'Confirmed'),
    },
    {
      id: 'createdAt',
      header: text('Created'),
      cell: (invoice) => formatDigits(new Date(invoice.createdAt).toLocaleDateString(locale)),
    },
    {
      id: 'actions',
      header: text('Actions'),
      className: 'inventory-action-cell',
      cell: (invoice) => (
        <div className="inventory-row-actions">
          {invoice.status === 'draft' && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setInvoiceEditor({ invoice, key: invoice.id })}
            >
              {text('Edit draft')}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant={invoice.status === 'draft' ? 'default' : 'ghost'}
            onClick={() => setInvoiceReview(invoice)}
          >
            {text(invoice.status === 'draft' ? 'Review receipt' : 'View')}
          </Button>
        </div>
      ),
    },
  ];

  const supplierColumns: DataTableColumn<PurchaseSupplier>[] = [
    {
      id: 'supplier',
      header: text('Supplier'),
      cell: (supplier) => (
        <div className="inventory-table-name">
          <strong>{formatDigits(supplier.name)}</strong>
          <small>
            {formatDigits(supplier.contactName || supplier.email || supplier.phone || '')}
          </small>
        </div>
      ),
    },
    { id: 'phone', header: text('Phone'), cell: (supplier) => formatDigits(supplier.phone ?? '—') },
    {
      id: 'status',
      header: text('Status'),
      cell: (supplier) => text(supplier.archivedAt ? 'Archived' : 'Active'),
    },
    {
      id: 'actions',
      header: text('Actions'),
      className: 'inventory-action-cell',
      cell: (supplier) => (
        <div className="inventory-row-actions">
          {!supplier.archivedAt && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setSupplierEditor({ supplier, key: supplier.id })}
            >
              {text('Edit')}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setSupplierArchive(supplier)}
          >
            {text(supplier.archivedAt ? 'Restore' : 'Archive')}
          </Button>
        </div>
      ),
    },
  ];

  function resetInvoiceFilters() {
    setInvoicePage({});
    setInvoiceHistory([]);
  }

  function resetSupplierFilters() {
    setSupplierPage({});
    setSupplierHistory([]);
  }

  function submitInvoiceSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInvoiceSearch(invoiceSearchDraft.trim());
    resetInvoiceFilters();
  }

  function submitSupplierSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSupplierSearch(supplierSearchDraft.trim());
    resetSupplierFilters();
  }

  async function saveSupplier(fields: SupplierFields, requestId?: string, revision?: number) {
    if (!supplierEditor || busy) return;
    setBusy(true);
    setLoadError('');
    try {
      const created = !supplierEditor.supplier;
      await apiRequest<PurchaseSupplier>(
        created
          ? '/owner/purchasing/suppliers'
          : `/owner/purchasing/suppliers/${supplierEditor.supplier!.id}`,
        {
          method: created ? 'POST' : 'PATCH',
          body: JSON.stringify(created ? { ...fields, requestId } : { ...fields, revision }),
        },
      );
      setSupplierEditor(null);
      setNotice(text(created ? 'Supplier created.' : 'Supplier updated.'));
      setSupplierSearch('');
      setSupplierSearchDraft('');
      setSupplierStatus('active');
      resetSupplierFilters();
      setRefreshKey((key) => key + 1);
    } catch (cause) {
      setLoadError(
        cause instanceof Error ? errorText(cause.message) : text('Could not save the supplier.'),
      );
    } finally {
      setBusy(false);
    }
  }

  async function changeSupplierArchive(supplier: PurchaseSupplier) {
    setBusy(true);
    setLoadError('');
    const archived = Boolean(supplier.archivedAt);
    try {
      await apiRequest<PurchaseSupplier>(
        `/owner/purchasing/suppliers/${supplier.id}/${archived ? 'restore' : 'archive'}`,
        { method: 'POST', body: JSON.stringify({ revision: supplier.revision }) },
      );
      setNotice(text(archived ? 'Supplier restored.' : 'Supplier archived.'));
      setRefreshKey((key) => key + 1);
    } catch (cause) {
      setLoadError(
        cause instanceof Error ? errorText(cause.message) : text('Could not update the supplier.'),
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveInvoice(
    fields: Omit<CreatePurchaseInvoiceRequest, 'requestId'>,
    requestId: string,
    revision?: number,
  ) {
    if (!invoiceEditor || busy) return;
    setBusy(true);
    setLoadError('');
    try {
      const existing = invoiceEditor.invoice;
      const invoice = await apiRequest<PurchaseInvoice>(
        existing ? `/owner/purchasing/invoices/${existing.id}` : '/owner/purchasing/invoices',
        {
          method: existing ? 'PATCH' : 'POST',
          body: JSON.stringify(existing ? { ...fields, revision } : { ...fields, requestId }),
        },
      );
      setInvoiceEditor(null);
      setNotice(
        text(existing ? 'Purchase invoice updated.' : 'Draft saved. Stock was not changed.'),
      );
      setInvoiceStatus('all');
      setInvoiceSearch('');
      setInvoiceSearchDraft('');
      resetInvoiceFilters();
      setRefreshKey((key) => key + 1);
      setInvoiceReview(invoice.status === 'draft' ? invoice : null);
    } catch (cause) {
      setLoadError(
        cause instanceof Error
          ? errorText(cause.message)
          : text('Could not save the purchase invoice.'),
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmInvoice() {
    if (!invoiceReview || busy || invoiceReview.status !== 'draft') return;
    setBusy(true);
    setLoadError('');
    const requestId = confirmRequestIds[invoiceReview.id] ?? crypto.randomUUID();
    setConfirmRequestIds((current) => ({ ...current, [invoiceReview.id]: requestId }));
    try {
      const result = await apiRequest<{ invoice: PurchaseInvoice; receipt: { replayed: boolean } }>(
        `/owner/purchasing/invoices/${invoiceReview.id}/confirm`,
        {
          method: 'POST',
          body: JSON.stringify({ requestId, revision: invoiceReview.revision }),
        },
      );
      setInvoiceReview(null);
      setNotice(
        text(
          result.receipt.replayed
            ? 'Purchase invoice was already confirmed; no duplicate stock was added.'
            : 'Purchase invoice confirmed and stock received.',
        ),
      );
      setConfirmRequestIds((current) => {
        const next = { ...current };
        delete next[invoiceReview.id];
        return next;
      });
      setInvoicePage({});
      setInvoiceHistory([]);
      setRefreshKey((key) => key + 1);
    } catch (cause) {
      setLoadError(
        cause instanceof Error
          ? errorText(cause.message)
          : text('Could not confirm the purchase invoice.'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="inventory-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <section className="inventory-intro">
        <div>
          <span className="inventory-eyebrow">{text('Purchasing')}</span>
          <h2>{text('Suppliers and purchase invoices')}</h2>
          <p>{text('Manage suppliers and receive purchases into a selected warehouse.')}</p>
          <small className="inventory-muted">
            {text(
              'This slice records received quantities only; it does not calculate costs, taxes, or supplier payments.',
            )}
          </small>
        </div>
        <div className="inventory-intro-actions">
          <Button type="button" variant="outline" onClick={() => navigate('/inventory')}>
            {text('Stock items')}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/inventory/operations')}>
            {text('Balances and movements')}
          </Button>
        </div>
      </section>

      {notice && (
        <p className="inventory-notice" role="status">
          {notice}
        </p>
      )}
      {loadError && (
        <div className="inventory-error" role="alert">
          <span>{loadError}</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => setLoadError('')}>
            {text('Close')}
          </Button>
        </div>
      )}

      <div className="inventory-tabs" role="tablist" aria-label={text('Purchasing')}>
        <Button
          type="button"
          variant={tab === 'invoices' ? 'default' : 'outline'}
          role="tab"
          aria-selected={tab === 'invoices'}
          onClick={() => setTab('invoices')}
        >
          {text('Purchase invoices')}
        </Button>
        <Button
          type="button"
          variant={tab === 'suppliers' ? 'default' : 'outline'}
          role="tab"
          aria-selected={tab === 'suppliers'}
          onClick={() => setTab('suppliers')}
        >
          {text('Suppliers')}
        </Button>
      </div>

      {tab === 'invoices' ? (
        <DashboardCard
          title={text('Purchase invoices')}
          description={text(
            'Confirming posts actual received quantities to this warehouse. Confirmed invoices cannot be edited.',
          )}
        >
          <div className="inventory-filters">
            <form className="inventory-search" onSubmit={submitInvoiceSearch}>
              <label>
                {text('Search purchase invoices')}
                <Input
                  value={invoiceSearchDraft}
                  onChange={(event) => setInvoiceSearchDraft(event.target.value)}
                  placeholder={text('Search')}
                />
              </label>
              <Button type="submit" variant="outline">
                {text('Search')}
              </Button>
            </form>
            <label className="inventory-filter-status">
              {text('Status')}
              <select
                value={invoiceStatus}
                onChange={(event) => {
                  setInvoiceStatus(event.target.value as typeof invoiceStatus);
                  resetInvoiceFilters();
                }}
              >
                <option value="all">{text('All')}</option>
                <option value="draft">{text('Draft')}</option>
                <option value="confirmed">{text('Confirmed')}</option>
              </select>
            </label>
            <Button
              type="button"
              onClick={() => setInvoiceEditor({ invoice: null, key: crypto.randomUUID() })}
            >
              {text('New purchase invoice')}
            </Button>
          </div>
          <DataTable
            columns={invoiceColumns}
            rows={invoices}
            rowKey={(invoice) => invoice.id}
            caption={text('Purchase invoices')}
            loading={invoicesLoading}
            loadingState={text('Loading purchase invoices…')}
            emptyState={text('No purchase invoices yet.')}
          />
          <PageControls
            page={invoicePage}
            history={invoiceHistory}
            next={invoiceNext}
            loading={invoicesLoading}
            onChange={setInvoicePage}
            onHistoryChange={setInvoiceHistory}
            copy={text}
          />
        </DashboardCard>
      ) : (
        <DashboardCard
          title={text('Suppliers')}
          description={text('Maintain an owner-managed supplier directory for purchase records.')}
        >
          <div className="inventory-filters">
            <form className="inventory-search" onSubmit={submitSupplierSearch}>
              <label>
                {text('Search suppliers')}
                <Input
                  value={supplierSearchDraft}
                  onChange={(event) => setSupplierSearchDraft(event.target.value)}
                  placeholder={text('Search')}
                />
              </label>
              <Button type="submit" variant="outline">
                {text('Search')}
              </Button>
            </form>
            <label className="inventory-filter-status">
              {text('Status')}
              <select
                value={supplierStatus}
                onChange={(event) => {
                  setSupplierStatus(event.target.value as typeof supplierStatus);
                  resetSupplierFilters();
                }}
              >
                <option value="active">{text('Active')}</option>
                <option value="archived">{text('Archived')}</option>
                <option value="all">{text('All')}</option>
              </select>
            </label>
            <Button
              type="button"
              onClick={() => setSupplierEditor({ supplier: null, key: crypto.randomUUID() })}
            >
              {text('Add supplier')}
            </Button>
          </div>
          <DataTable
            columns={supplierColumns}
            rows={suppliers}
            rowKey={(supplier) => supplier.id}
            caption={text('Suppliers')}
            loading={suppliersLoading}
            loadingState={text('Loading suppliers…')}
            emptyState={text('No suppliers yet.')}
          />
          <PageControls
            page={supplierPage}
            history={supplierHistory}
            next={supplierNext}
            loading={suppliersLoading}
            onChange={setSupplierPage}
            onHistoryChange={setSupplierHistory}
            copy={text}
          />
        </DashboardCard>
      )}

      {supplierEditor && (
        <SupplierEditor
          key={supplierEditor.key}
          supplier={supplierEditor.supplier}
          busy={busy}
          text={text}
          onClose={() => !busy && setSupplierEditor(null)}
          onSave={(fields, requestId, revision) => void saveSupplier(fields, requestId, revision)}
        />
      )}
      {invoiceEditor && (
        <PurchaseInvoiceEditor
          key={invoiceEditor.key}
          invoice={invoiceEditor.invoice}
          busy={busy}
          text={text}
          formatDigits={formatDigits}
          onClose={() => !busy && setInvoiceEditor(null)}
          onSave={(fields, requestId, revision) => void saveInvoice(fields, requestId, revision)}
        />
      )}
      {invoiceReview && (
        <DashboardDialog
          title={text('Review supplier invoice')}
          closeLabel={text('Close')}
          onClose={() => !busy && setInvoiceReview(null)}
          busy={busy}
        >
          <div className="products-dialog-body inventory-review">
            <p>
              <strong>{text('Supplier')}:</strong> {formatDigits(invoiceReview.supplierName)}
            </p>
            <p>
              <strong>{text('Supplier invoice number')}:</strong>{' '}
              {formatDigits(invoiceReview.supplierInvoiceNumber || '—')}
            </p>
            <p>
              <strong>{text('Warehouse')}:</strong>{' '}
              {formatDigits(`${invoiceReview.branchName} · ${invoiceReview.warehouseName}`)}
            </p>
            <p>
              {text(
                invoiceReview.status === 'draft'
                  ? 'This invoice is a draft. Saving it does not affect stock.'
                  : 'A confirmed purchase invoice cannot be edited. Correct stock with a separate reviewed movement.',
              )}
            </p>
            <ul>
              {invoiceReview.lines.map((line) => (
                <li key={line.id}>
                  <strong>{formatDigits(line.stockItemName)}</strong>
                  <span dir="ltr">{formatDigits(`${line.quantity} ${line.unitCode}`)}</span>
                  <small>
                    {text(line.condition === 'available' ? 'Available' : 'Non-Sellable')} ·{' '}
                    {formatDigits(`${line.baseUnit} (${line.unitName})`)}
                  </small>
                </li>
              ))}
            </ul>
          </div>
          {invoiceReview.status === 'draft' && (
            <footer className="products-dialog-footer">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setInvoiceReview(null)}
              >
                {text('Close')}
              </Button>
              <Button type="button" disabled={busy} onClick={() => void confirmInvoice()}>
                {text(busy ? 'Posting…' : 'Confirm receipt')}
              </Button>
            </footer>
          )}
        </DashboardDialog>
      )}
      {supplierArchive && (
        <DashboardDialog
          title={text(supplierArchive.archivedAt ? 'Restore' : 'Archive')}
          closeLabel={text('Close')}
          onClose={() => !busy && setSupplierArchive(null)}
          busy={busy}
        >
          <div className="products-dialog-body">
            <p>
              {text(
                supplierArchive.archivedAt ? 'Restore this supplier?' : 'Archive this supplier?',
              )}
            </p>
          </div>
          <footer className="products-dialog-footer">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setSupplierArchive(null)}
            >
              {text('Close')}
            </Button>
            <Button type="button" disabled={busy} onClick={() => void confirmSupplierArchive()}>
              {text(supplierArchive.archivedAt ? 'Restore' : 'Archive')}
            </Button>
          </footer>
        </DashboardDialog>
      )}
    </main>
  );

  async function confirmSupplierArchive() {
    if (!supplierArchive || busy) return;
    const target = supplierArchive;
    setSupplierArchive(null);
    await changeSupplierArchive(target);
  }
}
