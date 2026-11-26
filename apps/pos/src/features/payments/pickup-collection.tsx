import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { PosEmployeeSession } from '@waffarly/contracts';
import { PosButton } from '../../components/pos-button.js';
import { apiRequest } from '../../lib/api-client.js';
import { getCurrentPosShift, posCurrentShiftKey } from '../shifts/pos-shifts.api.js';
import { PosCheckoutDialog } from './pos-checkout-dialog.js';

export function PickupCollection({
  employee,
  branchId,
  orderId,
  onUpdated,
}: {
  employee: PosEmployeeSession;
  branchId: string;
  orderId: string;
  onUpdated: () => void;
}) {
  // Pickup cash goes into this device's paired register, like every other POS sale.
  const registerId = employee.deviceRegister?.id ?? '';
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const shift = useQuery({
    queryKey: posCurrentShiftKey(employee.merchantId, branchId, registerId),
    queryFn: ({ signal }) => getCurrentPosShift(registerId, signal),
    enabled: Boolean(registerId),
  });
  const hasOpenShift = shift.data?.status === 'open';
  async function prepare() {
    if (busy || !registerId || !hasOpenShift) return;
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/pos/orders/${encodeURIComponent(orderId)}/pickup-collection`, {
        method: 'POST',
        body: JSON.stringify({ registerId }),
      });
      setOpen(true);
      onUpdated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تجهيز التحصيل.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-2">
      {!registerId ? (
        <p role="status" className="m-0 rounded-lg bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
          الجهاز ده مش مربوط بدرج، فمش هينفع تحصيل طلب الاستلام منه.
        </p>
      ) : shift.isError ? (
        <button type="button" className="text-sm underline" onClick={() => void shift.refetch()}>
          تعذر التحقق من الوردية. إعادة المحاولة
        </button>
      ) : (
        !shift.isPending &&
        !hasOpenShift && (
          <p role="status" className="m-0 rounded-lg bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
            افتح وردية على درج {employee.deviceRegister?.name} عشان تحصّل طلب الاستلام.
          </p>
        )
      )}
      <PosButton
        type="button"
        disabled={busy || !registerId || !hasOpenShift}
        onClick={() => void prepare()}
      >
        {busy ? 'جارٍ تجهيز التحصيل…' : 'تحصيل طلب الاستلام'}
      </PosButton>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {open && (
        <PosCheckoutDialog
          merchantId={employee.merchantId}
          employeeId={employee.id}
          branchId={branchId}
          orderId={orderId}
          requiresRefundApproval={!employee.permissions.includes('approve_refunds')}
          onClose={() => {
            setOpen(false);
            onUpdated();
          }}
        />
      )}
    </div>
  );
}
