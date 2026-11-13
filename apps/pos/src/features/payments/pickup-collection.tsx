import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { PosEmployeeSession } from '@waffarly/contracts';
import { PosButton } from '../../components/pos-button.js';
import { apiRequest } from '../../lib/api-client.js';
import { listPosRegisters, posRegisterKey } from '../shifts/pos-shifts.api.js';
import { PosCheckoutDialog } from './pos-checkout-dialog.js';

export function PickupCollection({ employee, branchId, orderId, onUpdated }: {
  employee: PosEmployeeSession; branchId: string; orderId: string; onUpdated: () => void;
}) {
  const [registerId, setRegisterId] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const registers = useQuery({ queryKey: posRegisterKey(employee.merchantId, branchId), queryFn: ({ signal }) => listPosRegisters(branchId, signal) });
  async function prepare() {
    if (busy || !registerId) return;
    setBusy(true); setError('');
    try {
      await apiRequest(`/pos/orders/${encodeURIComponent(orderId)}/pickup-collection`, { method: 'POST', body: JSON.stringify({ registerId }) });
      setOpen(true); onUpdated();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر تجهيز التحصيل.'); }
    finally { setBusy(false); }
  }
  return <div className="grid gap-2">
    <label className="grid gap-1 text-sm">درج تحصيل طلب الاستلام
      <select value={registerId} disabled={busy || open} onChange={event => setRegisterId(event.target.value)} className="rounded-lg border border-border bg-background p-2">
        <option value="">اختار درجًا له وردية مفتوحة</option>
        {(registers.data ?? []).map(register => <option key={register.id} value={register.id}>{register.name}</option>)}
      </select>
    </label>
    {registers.isError && <button type="button" onClick={() => void registers.refetch()}>إعادة تحميل الأدراج</button>}
    <PosButton type="button" disabled={busy || !registerId} onClick={() => void prepare()}>{busy ? 'جارٍ تجهيز التحصيل…' : 'تحصيل طلب الاستلام'}</PosButton>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {open && <PosCheckoutDialog merchantId={employee.merchantId} employeeId={employee.id} branchId={branchId} orderId={orderId} requiresRefundApproval={!employee.permissions.includes('approve_refunds')} onClose={() => { setOpen(false); onUpdated(); }} />}
  </div>;
}
