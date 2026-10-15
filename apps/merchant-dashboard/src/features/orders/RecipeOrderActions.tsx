import { useState } from 'react';
import type { InventoryBranch, OwnerProfile, StorefrontOrderSummary } from '@waffarly/contracts';
import { useLocale } from '@waffarly/ui';
import { useOutletContext } from 'react-router-dom';
import { PagedEntitySelect } from '../../components/PagedEntitySelect.js';
import { ApiError, apiRequest } from '../../lib/api-client.js';

type SavedCommand = {
  action: 'accept' | 'start-preparation' | 'cancel';
  body: Record<string, unknown>;
};

export function RecipeOrderActions({
  order,
  onSaved,
  onReject,
}: {
  order: StorefrontOrderSummary;
  onSaved: (order: StorefrontOrderSummary) => void;
  onReject: () => void;
}) {
  const { locale, errorText } = useLocale();
  const { profile } = useOutletContext<{ profile: OwnerProfile }>();
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const storageKey = `waffarly:order-action:${profile.merchantId}:${order.id}`;
  const [pending, setPending] = useState<SavedCommand | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') as SavedCommand | null;
    } catch {
      return null;
    }
  });
  const [branchId, setBranchId] = useState('');
  const [reason, setReason] = useState('');
  const [restore, setRestore] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = busy || pending !== null;

  async function run(command: SavedCommand) {
    setError('');
    setBusy(true);
    try {
      // Persist before sending: uncertain network failures can only retry this same command.
      sessionStorage.setItem(storageKey, JSON.stringify(command));
      setPending(command);
      const saved = await apiRequest<StorefrontOrderSummary>(
        `/owner/orders/${order.id}/${command.action}`,
        { method: 'POST', body: JSON.stringify(command.body) },
      );
      sessionStorage.removeItem(storageKey);
      setPending(null);
      onSaved(saved);
    } catch (cause) {
      if (cause instanceof ApiError && [400, 404, 409].includes(cause.statusCode)) {
        sessionStorage.removeItem(storageKey);
        setPending(null);
      }
      setError(
        cause instanceof Error
          ? errorText(cause.message)
          : text('Could not update the order.', 'تعذر تحديث الطلب.'),
      );
    } finally {
      setBusy(false);
    }
  }
  const start = (action: SavedCommand['action'], body: Record<string, unknown> = {}) =>
    void run({ action, body: { requestId: crypto.randomUUID(), ...body } });
  return (
    <div className="recipe-order-actions">
      <p>
        {text(
          'Recipe ingredients are deducted when this order is accepted.',
          'تُخصم مكونات الوصفة عند قبول هذا الطلب.',
        )}
      </p>
      {order.inventoryLifecycle?.warehouseName && (
        <p>
          {order.inventoryLifecycle.branchName} / {order.inventoryLifecycle.warehouseName}
        </p>
      )}
      {pending && (
        <button
          type="button"
          className="orders-action-primary"
          disabled={busy}
          onClick={() => void run(pending)}
        >
          {text('Retry saved action', 'إعادة محاولة الإجراء المحفوظ')}
        </button>
      )}
      {order.status === 'pending' && (
        <>
          <PagedEntitySelect<Pick<InventoryBranch, 'id' | 'name'>>
            path="/owner/inventory/branches"
            value={branchId}
            label={text('Fulfillment branch', 'فرع تنفيذ الطلب')}
            disabled={locked}
            onSelect={(branch) => setBranchId(branch?.id ?? '')}
          />
          <p>
            {text(
              'Uses the branch’s active default consumption warehouse.',
              'يُستخدم مخزن الاستهلاك الافتراضي النشط للفرع.',
            )}
          </p>
          <div className="orders-action-group">
            <button
              type="button"
              className="orders-action-primary"
              disabled={locked || !branchId}
              onClick={() => start('accept', { branchId })}
            >
              {text('Accept and deduct ingredients', 'قبول وخصم المكونات')}
            </button>
            <button
              type="button"
              className="orders-action-danger"
              disabled={locked}
              onClick={onReject}
            >
              {text('Reject pending order', 'رفض الطلب المنتظر')}
            </button>
          </div>
        </>
      )}
      {order.status === 'accepted' && (
        <>
          <button
            type="button"
            className="orders-action-primary"
            disabled={locked}
            onClick={() => start('start-preparation')}
          >
            {text('Start preparation', 'بدء التحضير')}
          </button>
          <details>
            <summary>{text('Cancel before preparation', 'إلغاء قبل التحضير')}</summary>
            <div className="recipe-order-actions">
              <label>
                {text('Cancellation reason', 'سبب الإلغاء')}
                <input
                  type="text"
                  maxLength={500}
                  value={reason}
                  disabled={locked}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
              <label>
                {text('Stock decision', 'قرار المخزون')}
                <select
                  aria-label={text(
                    'Stock decision',
                    '\u0642\u0631\u0627\u0631 \u0627\u0644\u0645\u062e\u0632\u0648\u0646',
                  )}
                  value={restore}
                  disabled={locked}
                  onChange={(event) => setRestore(event.target.value)}
                >
                  <option value="">{text('Choose restoration', 'اختر قرار الإرجاع')}</option>
                  <option value="yes">
                    {text('Restore deducted stock', 'إرجاع الكميات المخصومة')}
                  </option>
                  <option value="no">{text('Keep stock deducted', 'إبقاء الكميات مخصومة')}</option>
                </select>
              </label>
              <button
                type="button"
                className="orders-action-danger"
                disabled={locked || !reason.trim() || !restore}
                onClick={() =>
                  start('cancel', { reason: reason.trim(), restoreStock: restore === 'yes' })
                }
              >
                {text('Confirm cancellation', 'تأكيد الإلغاء')}
              </button>
            </div>
          </details>
        </>
      )}
      {order.status === 'preparing' && (
        <p>
          {text(
            'Preparation started; cancellation is unavailable.',
            'بدأ التحضير؛ الإلغاء غير متاح.',
          )}
        </p>
      )}
      {order.status === 'cancelled' && (
        <p>
          {order.inventoryLifecycle?.cancellationReason} —{' '}
          {order.inventoryLifecycle?.stockRestored
            ? text('Stock restored', 'تم إرجاع المخزون')
            : text('Stock remains deducted', 'المخزون يظل مخصومًا')}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
