import { InventoryCard } from '../inventory/InventoryCard.js';
import {
  CursorPageControls as PageControls,
  type CursorPageState as PageState,
} from '../../components/CursorPageControls.js';
import { useEffect, useState, type FormEvent } from 'react';
import { Badge, Button, DataTable, Input, useLocale, type DataTableColumn } from '@waffarly/ui';
import type {
  CreatePurchaseInvoiceRequest,
  OwnerProfile,
  PurchaseInvoice,
  PurchaseSupplier,
} from '@waffarly/contracts';
import { DashboardDialog } from '../../components/DashboardDialog.js';
import { apiRequest, apiRequestPage } from '../../lib/api-client.js';
import { inventoryCopy } from '../inventory/inventory-copy.js';
import { useLocation, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { InventoryHeader } from '../inventory/InventoryHeader.js';
import type { SupplierFields } from './purchasing.types.js';
import { SupplierEditor } from './SupplierEditor.js';
import { PurchaseInvoiceEditor } from './PurchaseInvoiceEditor.js';

type SupplierEditorState = { supplier: PurchaseSupplier | null; key: string };

export function PurchaseInvoicesPage() {
  const { locale, t, errorText, formatDigits } = useLocale();
  const { profile } = useOutletContext<{ profile: OwnerProfile }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const text = (value: string) => inventoryCopy(value, locale, t);
  const normalizedPath = pathname.replace(/\/$/, '');
  const isNewInvoiceRoute = normalizedPath === '/inventory/purchases/new';
  const editRouteMatch = normalizedPath.match(/^\/inventory\/purchases\/([^/]+)\/edit$/);
  const sourceInvoiceMatch = normalizedPath.match(/^\/inventory\/purchases\/([^/]+)$/);
  const editorInvoiceId = editRouteMatch?.[1] ?? null;
  const sourceInvoiceId = sourceInvoiceMatch?.[1] ?? null;
  const isInvoiceEditor = isNewInvoiceRoute || editorInvoiceId !== null;
  const tab = searchParams.get('tab') === 'suppliers' ? 'suppliers' : 'invoices';
  function setTab(value: 'invoices' | 'suppliers') {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value === 'suppliers') next.set('tab', value);
      else next.delete('tab');
      return next;
    });
  }
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
  const [invoiceListError, setInvoiceListError] = useState('');
  const [supplierListError, setSupplierListError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [fetchedEditorInvoice, setFetchedEditorInvoice] = useState<PurchaseInvoice | null>(null);
  const [editorInvoiceLoading, setEditorInvoiceLoading] = useState(false);
  const [editorInvoiceError, setEditorInvoiceError] = useState('');
  const [supplierEditor, setSupplierEditor] = useState<SupplierEditorState | null>(null);
  const [invoiceReview, setInvoiceReview] = useState<PurchaseInvoice | null>(null);
  const [supplierArchive, setSupplierArchive] = useState<PurchaseSupplier | null>(null);
  useEffect(() => {
    if (!sourceInvoiceId) return;
    let current = true;
    void apiRequest<PurchaseInvoice>(`/owner/purchasing/invoices/${sourceInvoiceId}`)
      .then((invoice) => current && setInvoiceReview(invoice))
      .catch((cause: unknown) => {
        if (current)
          setLoadError(
            cause instanceof Error
              ? errorText(cause.message)
              : inventoryCopy('Could not load the purchase invoice.', locale, t),
          );
      });
    return () => {
      current = false;
    };
  }, [errorText, locale, sourceInvoiceId, t]);
  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    navigate('/inventory/purchases/new', { replace: true });
  }, [navigate, searchParams]);
  const [confirmRequestIds, setConfirmRequestIds] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!editorInvoiceId) {
      setFetchedEditorInvoice(null);
      setEditorInvoiceLoading(false);
      setEditorInvoiceError('');
      return;
    }
    const cachedInvoice = invoices.find((invoice) => invoice.id === editorInvoiceId);
    if (cachedInvoice) {
      setFetchedEditorInvoice(cachedInvoice);
      setEditorInvoiceLoading(false);
      setEditorInvoiceError('');
      return;
    }
    let current = true;
    setEditorInvoiceLoading(true);
    setEditorInvoiceError('');
    void apiRequest<PurchaseInvoice>(`/owner/purchasing/invoices/${editorInvoiceId}`)
      .then((invoice) => {
        if (current) setFetchedEditorInvoice(invoice);
      })
      .catch((cause: unknown) => {
        if (current)
          setEditorInvoiceError(
            cause instanceof Error ? errorText(cause.message) : text('Could not load the draft.'),
          );
      })
      .finally(() => {
        if (current) setEditorInvoiceLoading(false);
      });
    return () => {
      current = false;
    };
  }, [editorInvoiceId, errorText, invoices]);
  const editorInvoice = editorInvoiceId
    ? (invoices.find((invoice) => invoice.id === editorInvoiceId) ??
      (fetchedEditorInvoice?.id === editorInvoiceId ? fetchedEditorInvoice : null))
    : null;

  useEffect(() => {
    let current = true;
    setInvoicesLoading(true);
    setInvoiceListError('');
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
        if (current) {
          setInvoiceListError(
            cause instanceof Error
              ? errorText(cause.message)
              : text('Could not load purchase invoices.'),
          );
          setInvoices([]);
          setInvoiceNext(null);
        }
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
    setSupplierListError('');
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
        if (current) {
          setSupplierListError(
            cause instanceof Error ? errorText(cause.message) : text('Could not load suppliers.'),
          );
          setSuppliers([]);
          setSupplierNext(null);
        }
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
      cell: (invoice) => (
        <Badge variant={invoice.status === 'draft' ? 'warning' : 'success'}>
          {text(invoice.status === 'draft' ? 'Draft' : 'Received')}
        </Badge>
      ),
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
              onClick={() => {
                setLoadError('');
                navigate(`/inventory/purchases/${invoice.id}/edit`);
              }}
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
    reviewAfterSave = true,
  ) {
    if (!isInvoiceEditor || busy) return;
    setBusy(true);
    setLoadError('');
    try {
      const existing = editorInvoice;
      const invoice = await apiRequest<PurchaseInvoice>(
        existing ? `/owner/purchasing/invoices/${existing.id}` : '/owner/purchasing/invoices',
        {
          method: existing ? 'PATCH' : 'POST',
          body: JSON.stringify(existing ? { ...fields, revision } : { ...fields, requestId }),
        },
      );
      try {
        window.localStorage.removeItem(
          `waffarly:purchase-invoice:${profile.merchantId}:${existing?.id ?? 'new'}`,
        );
      } catch {
        // Storage can be unavailable in private browsing; the saved invoice is still safe.
      }
      setNotice(
        text(existing ? 'Purchase invoice updated.' : 'Draft saved. Stock was not changed.'),
      );
      setInvoiceStatus('all');
      setInvoiceSearch('');
      setInvoiceSearchDraft('');
      resetInvoiceFilters();
      setRefreshKey((key) => key + 1);
      setInvoiceReview(reviewAfterSave && invoice.status === 'draft' ? invoice : null);
      navigate('/inventory/purchases', { replace: true });
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

  if (isInvoiceEditor) {
    return (
      <div className="inventory-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        <InventoryHeader
          title={
            editorInvoiceId
              ? editorInvoice?.status === 'confirmed'
                ? 'Confirmed invoice'
                : 'Edit draft'
              : 'New purchase invoice'
          }
          description="Save a draft, review received quantities, then add them to your warehouse."
          actions={
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => navigate('/inventory/purchases')}
            >
              {text('Back to purchases')}
            </Button>
          }
        />
        {editorInvoiceId && !editorInvoice && (editorInvoiceLoading || !editorInvoiceError) && (
          <InventoryCard title={text('Loading draft')}>
            <p role="status">{text('Loading purchase invoice…')}</p>
          </InventoryCard>
        )}
        {editorInvoiceId && !editorInvoice && editorInvoiceError && !editorInvoiceLoading && (
          <InventoryCard title={text('Draft unavailable')}>
            <p role="alert">{editorInvoiceError || text('Could not load the draft.')}</p>
          </InventoryCard>
        )}
        {editorInvoice?.status === 'confirmed' && (
          <InventoryCard title={text('Confirmed invoice')}>
            <p>
              {text(
                'Confirmed invoices cannot be edited. Use a reviewed stock movement to correct the received quantity.',
              )}
            </p>
          </InventoryCard>
        )}
        {(!editorInvoiceId || editorInvoice?.status === 'draft') &&
          (!editorInvoiceId || Boolean(editorInvoice)) && (
            <PurchaseInvoiceEditor
              key={editorInvoice?.id ?? 'new'}
              invoice={editorInvoice}
              busy={busy}
              error={loadError}
              text={text}
              formatDigits={formatDigits}
              draftStorageKey={`waffarly:purchase-invoice:${profile.merchantId}:${editorInvoice?.id ?? 'new'}`}
              onClose={() => !busy && navigate('/inventory/purchases')}
              onSave={(fields, requestId, revision, reviewAfterSave) =>
                void saveInvoice(fields, requestId, revision, reviewAfterSave)
              }
            />
          )}
      </div>
    );
  }

  return (
    <div className="inventory-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <InventoryHeader
        title="Purchases"
        description="Save a draft, review received quantities, then add them to your warehouse."
        actions={
          <Button
            type="button"
            onClick={() => {
              setLoadError('');
              if (tab === 'suppliers')
                setSupplierEditor({ supplier: null, key: crypto.randomUUID() });
              else navigate('/inventory/purchases/new');
            }}
          >
            {text(tab === 'suppliers' ? 'Add supplier' : 'New purchase invoice')}
          </Button>
        }
      />

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
        <InventoryCard
          title={text('Purchase invoices')}
          description={text(
            'Confirming posts actual received quantities to this warehouse. Confirmed invoices cannot be edited.',
          )}
        >
          {invoiceListError && (
            <div className="inventory-error" role="alert">
              <span>{invoiceListError}</span>
              <span className="inventory-error-actions">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setInvoiceListError('');
                    setRefreshKey((key) => key + 1);
                  }}
                >
                  {text('Retry')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setInvoiceListError('')}
                >
                  {text('Close')}
                </Button>
              </span>
            </div>
          )}
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
            {(invoiceSearchDraft || invoiceSearch || invoiceStatus !== 'all') && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setInvoiceSearch('');
                  setInvoiceSearchDraft('');
                  setInvoiceStatus('all');
                  resetInvoiceFilters();
                }}
              >
                {text('Clear filters')}
              </Button>
            )}
          </div>
          <DataTable
            columns={invoiceColumns}
            rows={invoices}
            rowKey={(invoice) => invoice.id}
            caption={text('Purchase invoices')}
            loading={invoicesLoading}
            loadingState={text('Loading purchase invoices…')}
            emptyState={
              <div className="inventory-empty">
                <h3>
                  {text(
                    invoiceListError
                      ? 'Could not load purchase invoices.'
                      : invoiceSearch || invoiceStatus !== 'all'
                        ? 'No matching purchases'
                        : 'No purchase invoices yet.',
                  )}
                </h3>
                <p>
                  {invoiceListError ||
                    text(
                      invoiceSearch || invoiceStatus !== 'all'
                        ? 'Try another search or clear the filters.'
                        : 'Record a delivery from a supplier, then review it before adding stock.',
                    )}
                </p>
                {!invoiceListError && !invoiceSearch && invoiceStatus === 'all' && (
                  <Button
                    onClick={() => {
                      setLoadError('');
                      navigate('/inventory/purchases/new');
                    }}
                  >
                    {text('Record purchase')}
                  </Button>
                )}
              </div>
            }
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
        </InventoryCard>
      ) : (
        <InventoryCard
          title={text('Suppliers')}
          description={text('Maintain an owner-managed supplier directory for purchase records.')}
        >
          {supplierListError && (
            <div className="inventory-error" role="alert">
              <span>{supplierListError}</span>
              <span className="inventory-error-actions">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSupplierListError('');
                    setRefreshKey((key) => key + 1);
                  }}
                >
                  {text('Retry')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSupplierListError('')}
                >
                  {text('Close')}
                </Button>
              </span>
            </div>
          )}
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
            {(supplierSearchDraft || supplierSearch || supplierStatus !== 'active') && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSupplierSearch('');
                  setSupplierSearchDraft('');
                  setSupplierStatus('active');
                  resetSupplierFilters();
                }}
              >
                {text('Clear filters')}
              </Button>
            )}
          </div>
          <DataTable
            columns={supplierColumns}
            rows={suppliers}
            rowKey={(supplier) => supplier.id}
            caption={text('Suppliers')}
            loading={suppliersLoading}
            loadingState={text('Loading suppliers…')}
            emptyState={
              <div className="inventory-empty">
                <h3>
                  {text(
                    supplierListError
                      ? 'Could not load suppliers.'
                      : supplierSearch || supplierStatus !== 'active'
                        ? 'No matching suppliers'
                        : 'No suppliers yet.',
                  )}
                </h3>
                <p>
                  {supplierListError ||
                    text(
                      supplierSearch || supplierStatus !== 'active'
                        ? 'Try another search or clear the filters.'
                        : 'Add supplier contact details to start recording deliveries.',
                    )}
                </p>
              </div>
            }
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
        </InventoryCard>
      )}

      {supplierEditor && (
        <SupplierEditor
          key={supplierEditor.key}
          supplier={supplierEditor.supplier}
          busy={busy}
          error={loadError}
          text={text}
          onClose={() => !busy && setSupplierEditor(null)}
          onSave={(fields, requestId, revision) => void saveSupplier(fields, requestId, revision)}
        />
      )}
      {invoiceReview && (
        <DashboardDialog
          title={text('Review supplier invoice')}
          closeLabel={text('Close')}
          onClose={() => {
            if (busy) return;
            if (sourceInvoiceId) navigate('/inventory/purchases', { replace: true });
            else setInvoiceReview(null);
          }}
          busy={busy}
          wide
        >
          <div className="products-dialog-body inventory-review">
            {loadError && (
              <p className="inventory-error" role="alert">
                {loadError}
              </p>
            )}
            {invoiceReview.status === 'draft' && (
              <ol className="inventory-flow" aria-label={text('Purchase progress')}>
                <li>{text('Supplier and warehouse')}</li>
                <li>{text('Items and quantities')}</li>
                <li aria-current="step">{text('Review and receive')}</li>
              </ol>
            )}
            {invoiceReview.status === 'draft' && (
              <p className="inventory-note">
                {text('Receiving this purchase adds the quantities below to:')}{' '}
                <strong>{formatDigits(invoiceReview.warehouseName)}</strong>
              </p>
            )}
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
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setLoadError('');
                  setInvoiceReview(null);
                  navigate(`/inventory/purchases/${invoiceReview.id}/edit`);
                }}
              >
                {text('Edit draft')}
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
    </div>
  );

  async function confirmSupplierArchive() {
    if (!supplierArchive || busy) return;
    const target = supplierArchive;
    setSupplierArchive(null);
    await changeSupplierArchive(target);
  }
}
