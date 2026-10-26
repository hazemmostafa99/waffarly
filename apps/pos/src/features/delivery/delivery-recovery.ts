import { create } from 'zustand';
import type { PosDeliveryCommand, RecordPosCheckPaymentRequest } from '@waffarly/contracts';

export type PendingDeliveryWrite = { branchId: string; orderId: string } & (
  | { kind: 'action'; request: PosDeliveryCommand }
  | { kind: 'payment'; checkId: string; request: RecordPosCheckPaymentRequest }
);
const uuid = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const amount = (v: unknown): v is string =>
  typeof v === 'string' && /^(?=.*[1-9])\d{1,10}(?:\.\d{1,2})?$/.test(v);
const object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const keys = (v: Record<string, unknown>, allowed: string[]) =>
  Object.keys(v).every((key) => allowed.includes(key));

/** Reject extra fields rather than rehydrating credentials or a changed payment envelope. */
export function decodeDeliveryRecovery(value: unknown): PendingDeliveryWrite {
  if (!object(value) || !uuid(value.branchId) || !uuid(value.orderId) || !object(value.request))
    throw new Error('Invalid saved delivery action.');
  const r = value.request;
  if (
    !uuid(r.requestId) ||
    typeof r.revision !== 'number' ||
    !Number.isSafeInteger(r.revision) ||
    r.revision < 1
  )
    throw new Error('Invalid saved delivery action.');
  if (value.kind === 'action' && keys(value, ['branchId', 'orderId', 'kind', 'request'])) {
    const allowed = ['requestId', 'revision', 'action'];
    if (
      r.action === 'dispatch' &&
      typeof r.courierName === 'string' &&
      r.courierName.trim() &&
      r.courierName.length <= 160
    )
      allowed.push('courierName');
    else if (
      r.action === 'failed' &&
      typeof r.reason === 'string' &&
      r.reason.trim() &&
      r.reason.length <= 500
    )
      allowed.push('reason');
    else if (r.action === 'claim' && uuid(r.receivingShiftId)) allowed.push('receivingShiftId');
    else if (
      r.action === 'remit' &&
      uuid(r.receivingShiftId) &&
      uuid(r.paymentId) &&
      amount(r.amount)
    )
      allowed.push('receivingShiftId', 'paymentId', 'amount');
    else if (r.action !== 'delivered') throw new Error('Invalid saved delivery action.');
    if (keys(r, allowed)) return value as unknown as PendingDeliveryWrite;
  }
  if (
    value.kind === 'payment' &&
    uuid(value.checkId) &&
    keys(value, ['branchId', 'orderId', 'kind', 'checkId', 'request']) &&
    keys(r, ['requestId', 'revision', 'tenders', 'cashCustody', 'receivingShiftId']) &&
    Array.isArray(r.tenders) &&
    r.tenders.length === 1
  ) {
    const tender: unknown = r.tenders[0];
    const validTender =
      object(tender) &&
      amount(tender.amount) &&
      ((tender.method === 'cash' &&
        amount(tender.receivedAmount) &&
        keys(tender, ['method', 'amount', 'receivedAmount'])) ||
        (tender.method === 'terminal' &&
          keys(tender, ['method', 'amount', 'terminalReference']) &&
          (tender.terminalReference === undefined ||
            (typeof tender.terminalReference === 'string' &&
              tender.terminalReference.length <= 80))));
    if (
      validTender &&
      ((r.cashCustody === 'courier' &&
        r.receivingShiftId === undefined &&
        object(tender) &&
        tender.method === 'cash') ||
        (r.cashCustody === undefined && uuid(r.receivingShiftId)))
    )
      return value as unknown as PendingDeliveryWrite;
  }
  throw new Error('Invalid saved delivery action.');
}

interface RecoveryState {
  scope: string | null;
  pending: PendingDeliveryWrite | null;
  error: string;
  hydrate: (scope: string) => void;
  save: (scope: string, pending: PendingDeliveryWrite) => void;
  clear: (scope: string, requestId: string) => void;
}
export const useDeliveryRecovery = create<RecoveryState>((set, get) => ({
  scope: null,
  pending: null,
  error: '',
  hydrate: (scope) => {
    if (get().scope === scope) return;
    try {
      const stored = localStorage.getItem(scope);
      set({
        scope,
        pending: stored ? decodeDeliveryRecovery(JSON.parse(stored)) : null,
        error: '',
      });
    } catch {
      set({
        scope,
        pending: null,
        error: 'Could not read saved delivery recovery. Check browser storage before continuing.',
      });
    }
  },
  save: (scope, pending) => {
    if (get().scope !== scope || get().error) throw new Error('Delivery recovery is not ready.');
    const safe = decodeDeliveryRecovery(pending);
    if (get().pending && JSON.stringify(get().pending) !== JSON.stringify(safe))
      throw new Error('Resolve the saved delivery action first.');
    localStorage.setItem(scope, JSON.stringify(safe));
    set({ pending: safe });
  },
  clear: (scope, requestId) => {
    if (get().scope !== scope || get().pending?.request.requestId !== requestId) return;
    try {
      localStorage.removeItem(scope);
      set({ pending: null, error: '' });
    } catch {
      set({
        error:
          'The delivery action succeeded but its saved recovery could not be cleared. Retry the same action.',
      });
    }
  },
}));
