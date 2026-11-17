import { useEffect, useState, type FormEvent } from 'react';
import {
  DashboardCard,
  DataTable,
  Input,
  useLocale,
  type DataTableColumn,
} from '@waffarly/ui';
import type {
  CreateDeliveryCourierRequest,
  CursorPage,
  DeliveryCourierPerformance,
  DeliveryCourierPerformanceReport,
  DeliveryCourierSummary,
  InventoryBranch,
  UpdateDeliveryCourierRequest,
} from '@waffarly/contracts';
import { DashboardDialog } from '../../components/DashboardDialog.js';
import { Icon } from '../../Icons.js';
import { apiRequest, apiRequestPage } from '../../lib/api-client.js';

type CourierStatus = 'all' | 'active' | 'inactive';

type CourierDraft = {
  name: string;
  phone: string;
  branchIds: string[];
  active: boolean;
};

function emptyDraft(): CourierDraft {
  return { name: '', phone: '', branchIds: [], active: true };
}

export function CouriersPage() {
  const { locale, errorText } = useLocale();
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const [page, setPage] = useState<CursorPage<DeliveryCourierSummary>>({
    items: [],
    nextCursor: null,
  });
  const [performance, setPerformance] = useState<DeliveryCourierPerformanceReport | null>(null);
  const [branches, setBranches] = useState<InventoryBranch[]>([]);
  const [history, setHistory] = useState<Array<string | undefined>>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CourierStatus>('all');
  const [editing, setEditing] = useState<DeliveryCourierSummary | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<CourierDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [performanceLoading, setPerformanceLoading] = useState(true);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [performanceError, setPerformanceError] = useState('');
  const [branchError, setBranchError] = useState('');
  const [editorError, setEditorError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [performanceRefresh, setPerformanceRefresh] = useState(0);
  const [branchRefresh, setBranchRefresh] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setLoadError('');
    const query = new URLSearchParams({ limit: '25', status });
    if (search.trim()) query.set('search', search.trim());
    const cursor = history.at(-1);
    if (cursor) query.set('cursor', cursor);

    void apiRequestPage<DeliveryCourierSummary>(`/owner/delivery-couriers?${query.toString()}`)
      .then((result) => {
        if (current) setPage(result);
      })
      .catch((cause: unknown) => {
        if (!current) return;
        setLoadError(
          cause instanceof Error
            ? errorText(cause.message)
            : text('Could not load delivery couriers.', 'تعذّر تحميل طياري التوصيل.'),
        );
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [errorText, history, refresh, search, status]);

  useEffect(() => {
    let current = true;
    setPerformanceLoading(true);
    setPerformanceError('');

    void apiRequest<DeliveryCourierPerformanceReport>('/owner/delivery-couriers/performance')
      .then((report) => {
        if (current) setPerformance(report);
      })
      .catch((cause: unknown) => {
        if (!current) return;
        setPerformanceError(
          cause instanceof Error
            ? errorText(cause.message)
            : text('Could not load courier performance.', 'تعذّر تحميل أداء الطيارين.'),
        );
      })
      .finally(() => {
        if (current) setPerformanceLoading(false);
      });

    return () => {
      current = false;
    };
  }, [errorText, performanceRefresh, refresh]);

  useEffect(() => {
    let current = true;
    setBranchesLoading(true);
    setBranchError('');

    void apiRequest<InventoryBranch[]>('/owner/inventory/branches?limit=100&status=all')
      .then((items) => {
        if (current) setBranches(items.sort((left, right) => left.name.localeCompare(right.name)));
      })
      .catch((cause: unknown) => {
        if (!current) return;
        setBranchError(
          cause instanceof Error
            ? errorText(cause.message)
            : text('Could not load branches.', 'تعذّر تحميل الفروع.'),
        );
        setBranches([]);
      })
      .finally(() => {
        if (current) setBranchesLoading(false);
      });

    return () => {
      current = false;
    };
  }, [branchRefresh, errorText]);

  function startCreate() {
    setEditing(null);
    setDraft(emptyDraft());
    setEditorError('');
    setEditorOpen(true);
  }

  function startEdit(courier: DeliveryCourierSummary) {
    setEditing(courier);
    setDraft({
      name: courier.name,
      phone: courier.phone ?? '',
      branchIds: courier.branches.map((branch) => branch.id),
      active: courier.active,
    });
    setEditorError('');
    setEditorOpen(true);
  }

  function closeEditor() {
    if (busy) return;
    setEditorOpen(false);
    setEditing(null);
    setDraft(emptyDraft());
    setEditorError('');
  }

  function toggleBranch(branchId: string) {
    setDraft((current) => ({
      ...current,
      branchIds: current.branchIds.includes(branchId)
        ? current.branchIds.filter((id) => id !== branchId)
        : [...current.branchIds, branchId],
    }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setEditorError('');

    if (draft.branchIds.length === 0) {
      setEditorError(text('Assign at least one branch.', 'عيّن الطيار لفرع واحد على الأقل.'));
      return;
    }
    if (
      draft.active &&
      !draft.branchIds.some((branchId) =>
        branches.some((branch) => branch.id === branchId && branch.archivedAt === null),
      )
    ) {
      setEditorError(
        text(
          'An active courier needs at least one active branch.',
          'الطيار النشط لازم يكون معيّنًا لفرع نشط واحد على الأقل.',
        ),
      );
      return;
    }

    setBusy(true);
    const baseRequest: CreateDeliveryCourierRequest = {
      name: draft.name.trim(),
      phone: draft.phone.trim() || null,
      branchIds: draft.branchIds,
    };

    try {
      const request: CreateDeliveryCourierRequest | UpdateDeliveryCourierRequest = editing
        ? { ...baseRequest, revision: editing.revision, active: draft.active }
        : baseRequest;
      await apiRequest<DeliveryCourierSummary>(
        editing ? `/owner/delivery-couriers/${editing.id}` : '/owner/delivery-couriers',
        {
          method: editing ? 'PATCH' : 'POST',
          body: JSON.stringify(request),
        },
      );
      setNotice(
        editing
          ? text('Courier settings saved.', 'تم حفظ بيانات الطيار.')
          : text('Courier added.', 'تمت إضافة الطيار.'),
      );
      setEditorOpen(false);
      setEditing(null);
      setDraft(emptyDraft());
      setHistory([]);
      setRefresh((value) => value + 1);
    } catch (cause: unknown) {
      setEditorError(
        cause instanceof Error
          ? errorText(cause.message)
          : text('Could not save this courier.', 'تعذّر حفظ بيانات الطيار.'),
      );
    } finally {
      setBusy(false);
    }
  }

  const columns: DataTableColumn<DeliveryCourierSummary>[] = [
    {
      id: 'courier',
      header: text('Courier', 'الطيار'),
      cell: (courier) => (
        <div className="products-identity">
          <span className="products-thumb-empty">
            <Icon name="customers" />
          </span>
          <div>
            <strong>{courier.name}</strong>
            <small dir="ltr">{courier.phone ?? text('No phone number', 'بدون رقم هاتف')}</small>
          </div>
        </div>
      ),
    },
    {
      id: 'branches',
      header: text('Assigned branches', 'الفروع المعيّنة'),
      cell: (courier) => (
        <div className="courier-table-branches">
          {courier.branches.map((branch) => (
            <span
              className={`products-pill ${branch.archivedAt ? 'cream' : 'blue'}`}
              key={branch.id}
            >
              {branch.name}
              {branch.archivedAt ? ` · ${text('Archived', 'مؤرشف')}` : ''}
            </span>
          ))}
        </div>
      ),
    },
    {
      id: 'status',
      header: text('Status', 'الحالة'),
      cell: (courier) => (
        <span className={`products-pill ${courier.active ? 'mint' : 'cream'}`}>
          {courier.active ? text('Active', 'نشط') : text('Inactive', 'غير نشط')}
        </span>
      ),
    },
    {
      id: 'actions',
      header: text('Actions', 'الإجراءات'),
      cell: (courier) => (
        <button
          className="products-button courier-edit-button"
          type="button"
          onClick={() => startEdit(courier)}
        >
          <Icon name="edit" />
          {text('Edit', 'تعديل')}
        </button>
      ),
    },
  ];

  const performanceColumns: DataTableColumn<DeliveryCourierPerformance>[] = [
    {
      id: 'courier',
      header: text('Courier', 'الطيار'),
      cell: (courier) => (
        <div className="courier-performance-name">
          <strong>{courier.courierName}</strong>
          <span className={`products-pill ${courier.active ? 'mint' : 'cream'}`}>
            {courier.active ? text('Active', 'نشط') : text('Inactive', 'غير نشط')}
          </span>
        </div>
      ),
    },
    {
      id: 'attempts',
      header: text('Attempts', 'المحاولات'),
      cell: (courier) => courier.attemptCount,
    },
    {
      id: 'delivered',
      header: text('Delivered', 'تم التوصيل'),
      cell: (courier) => courier.deliveredCount,
    },
    {
      id: 'failed',
      header: text('Failed', 'فشل'),
      cell: (courier) => courier.failedCount,
    },
    {
      id: 'in-progress',
      header: text('In progress', 'جاري'),
      cell: (courier) => courier.activeAttemptCount,
    },
    {
      id: 'success-rate',
      header: text('Success rate', 'نسبة النجاح'),
      cell: (courier) =>
        courier.successRate === null
          ? '—'
          : `${new Intl.NumberFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
              maximumFractionDigits: 1,
            }).format(courier.successRate)}%`,
    },
    {
      id: 'average-time',
      header: text('Avg. delivery time', 'متوسط وقت التوصيل'),
      cell: (courier) =>
        courier.averageDeliveryMinutes === null
          ? '—'
          : `${new Intl.NumberFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
              maximumFractionDigits: 1,
            }).format(courier.averageDeliveryMinutes)} ${text('min', 'دقيقة')}`,
    },
  ];

  const hasFilters = Boolean(search.trim()) || status !== 'all';

  return (
    <section className="courier-workspace" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <h1 className="sr-only">{text('Delivery couriers', 'طيارو التوصيل')}</h1>

      {loadError && (
        <div className="products-error courier-load-error" role="alert">
          <span>{loadError}</span>
          <button
            className="products-button"
            type="button"
            disabled={loading}
            onClick={() => setRefresh((value) => value + 1)}
          >
            {text('Retry', 'إعادة المحاولة')}
          </button>
        </div>
      )}
      {notice && (
        <p className="products-notice" role="status">
          {notice}
        </p>
      )}

      <DashboardCard
        className="courier-performance-card"
        title={text('Courier performance · last 30 days', 'أداء الطيارين · آخر ٣٠ يومًا')}
        description={text(
          'Each dispatch is counted separately, so a failed attempt stays with the courier who handled it. These are operating measures only; no courier pay is tracked.',
          'كل خروج للتوصيل بيتحسب كمحاولة مستقلة، فالمحاولة الفاشلة بتفضل محسوبة على الطيار اللي استلمها. دي مؤشرات تشغيلية فقط ومفيش تسجيل لأجور الطيارين.',
        )}
      >
        {performanceError && (
          <div className="products-error courier-performance-error" role="alert">
            <span>{performanceError}</span>
            <button
              className="products-button"
              type="button"
              disabled={performanceLoading}
              onClick={() => setPerformanceRefresh((value) => value + 1)}
            >
              {text('Retry', 'إعادة المحاولة')}
            </button>
          </div>
        )}
        {performance && (
          <p className="courier-performance-period">
            {text('Since', 'من')} {new Intl.DateTimeFormat(
              locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB',
              { dateStyle: 'medium' },
            ).format(new Date(performance.periodStart))}
          </p>
        )}
        {(!performanceError || performance) && (
          <DataTable
            columns={performanceColumns}
            rows={performance?.items ?? []}
            rowKey={(courier) => courier.courierId}
            caption={text('Courier performance', 'أداء الطيارين')}
            loading={performanceLoading}
            loadingState={text('Loading performance…', 'جارٍ تحميل الأداء…')}
            emptyState={
              <div className="courier-empty">
                <strong>{text('No courier records yet', 'لا توجد بيانات طيارين بعد')}</strong>
                <p>
                  {text(
                    'Dispatch a delivery to start collecting performance history.',
                    'ابدأ بتسليم طلب لطيار عشان يبدأ تسجيل الأداء.',
                  )}
                </p>
              </div>
            }
          />
        )}
      </DashboardCard>

      <div className="courier-toolbar">
        <div className="products-filters courier-list-filters">
          <label className="products-search">
            <Icon name="search" />
            <input
              aria-label={text('Search delivery couriers', 'ابحث عن طياري التوصيل')}
              placeholder={text('Search by name or phone', 'البحث بالاسم أو رقم الهاتف')}
              value={search}
              maxLength={160}
              type="search"
              onChange={(event) => {
                setSearch(event.target.value);
                setHistory([]);
              }}
            />
          </label>
          <select
            aria-label={text('Courier status', 'حالة الطيار')}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as CourierStatus);
              setHistory([]);
            }}
          >
            <option value="all">{text('All couriers', 'كل الطيارين')}</option>
            <option value="active">{text('Active', 'نشط')}</option>
            <option value="inactive">{text('Inactive', 'غير نشط')}</option>
          </select>
        </div>
        <div className="courier-toolbar-actions">
          <button className="products-button primary" type="button" onClick={startCreate}>
            <Icon name="plus" />
            {text('Add courier', 'إضافة طيار')}
          </button>
        </div>
      </div>

      <DashboardCard
        className="courier-table-card"
        title={text('Courier list', 'قائمة الطيارين')}
        description={text(
          'Manage courier contact details, branch assignments, and availability.',
          'إدارة بيانات التواصل والفروع المعيّنة وحالة التوفر للطيارين.',
        )}
      >
        <DataTable
          columns={columns}
          rows={page.items}
          rowKey={(courier) => courier.id}
          caption={text('Courier list', 'قائمة الطيارين')}
          loading={loading}
          loadingState={text('Loading couriers…', 'جارٍ تحميل الطيارين…')}
          emptyState={
            <div className="courier-empty">
              <strong>
                {hasFilters
                  ? text('No matching couriers', 'لا يوجد طيارون مطابقون')
                  : text('No couriers yet', 'لا يوجد طيارون بعد')}
              </strong>
              <p>
                {hasFilters
                  ? text(
                      'Try another search or change the status filter.',
                      'جرّب بحثًا آخر أو غيّر فلتر الحالة.',
                    )
                  : text(
                      'Add a courier and assign the branches they can serve.',
                      'أضف طيارًا وعيّن له الفروع التي يعمل بها.',
                    )}
              </p>
            </div>
          }
        />
        <div className="courier-pagination">
          <span>
            {text('Couriers on this page:', 'الطيارون في هذه الصفحة:')} {page.items.length}
          </span>
          <div>
            <button
              className="products-button"
              type="button"
              disabled={!history.length || loading}
              onClick={() => setHistory((current) => current.slice(0, -1))}
            >
              {text('Previous', 'السابق')}
            </button>
            <button
              className="products-button"
              type="button"
              disabled={!page.nextCursor || loading}
              onClick={() => {
                if (page.nextCursor) setHistory((current) => [...current, page.nextCursor!]);
              }}
            >
              {text('Next', 'التالي')}
            </button>
          </div>
        </div>
      </DashboardCard>

      {editorOpen && (
        <DashboardDialog
          title={
            editing ? text('Edit courier', 'تعديل بيانات الطيار') : text('New courier', 'طيار جديد')
          }
          closeLabel={text('Close', 'إغلاق')}
          onClose={closeEditor}
          busy={busy}
          className="courier-dialog"
        >
          <form className="courier-editor" onSubmit={(event) => void save(event)}>
            {editorError && (
              <p className="courier-message courier-error" role="alert">
                {editorError}
              </p>
            )}
            <fieldset className="courier-editor-fields" disabled={busy}>
              <div className="courier-form-grid">
                <label>
                  {text('Courier name', 'اسم الطيار')}
                  <Input
                    autoFocus
                    required
                    minLength={2}
                    maxLength={160}
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  />
                </label>
                <label>
                  {text('Phone number (optional)', 'رقم الهاتف (اختياري)')}
                  <Input
                    type="tel"
                    maxLength={32}
                    autoComplete="tel"
                    value={draft.phone}
                    onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                  />
                </label>
                {editing && (
                  <label className="courier-active-toggle">
                    <input
                      type="checkbox"
                      checked={draft.active}
                      onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
                    />
                    {text('Courier is active', 'الطيار نشط')}
                  </label>
                )}
              </div>

              <fieldset className="courier-branches">
                <legend>{text('Assigned branches', 'الفروع المعيّنة')}</legend>
                {branchesLoading ? (
                  <p className="courier-branch-message" role="status">
                    {text('Loading branches…', 'جارٍ تحميل الفروع…')}
                  </p>
                ) : branchError ? (
                  <div className="courier-branch-message" role="alert">
                    <span>{branchError}</span>
                    <button
                      className="products-button"
                      type="button"
                      onClick={() => setBranchRefresh((value) => value + 1)}
                    >
                      {text('Retry', 'إعادة المحاولة')}
                    </button>
                  </div>
                ) : branches.length === 0 ? (
                  <p className="courier-branch-message">
                    {text('Add a branch before assigning a courier.', 'أضف فرعًا قبل تعيين الطيار.')}
                  </p>
                ) : (
                  <div className="courier-branch-list">
                    {branches.map((branch) => (
                      <label className="courier-branch-option" key={branch.id}>
                        <input
                          type="checkbox"
                          checked={draft.branchIds.includes(branch.id)}
                          onChange={() => toggleBranch(branch.id)}
                        />
                        <span>
                          <strong>{branch.name}</strong>
                          {branch.archivedAt && (
                            <small>{text('Archived', 'مؤرشف')}</small>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                <p className="courier-branch-help">
                  {text(
                    'An active courier must have at least one active branch.',
                    'الطيار النشط لازم يكون معيّنًا لفرع نشط واحد على الأقل.',
                  )}
                </p>
              </fieldset>
            </fieldset>
            <footer className="courier-form-actions">
              <button
                className="products-button"
                type="button"
                disabled={busy}
                onClick={closeEditor}
              >
                {text('Cancel', 'إلغاء')}
              </button>
              <button className="products-button primary" type="submit" disabled={busy}>
                {busy
                  ? text('Saving…', 'جارٍ الحفظ…')
                  : editing
                    ? text('Save courier', 'حفظ بيانات الطيار')
                    : text('Add courier', 'إضافة الطيار')}
              </button>
            </footer>
          </form>
        </DashboardDialog>
      )}
    </section>
  );
}
