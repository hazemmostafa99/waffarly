import type {
  ClosePosShiftRequest,
  PosShiftClosePreview,
  PosShiftClosePreviewRequest,
  OpenPosShiftRequest,
  PosRegisterOption,
  PosShiftCloseReport,
  PosShiftLiveSummary,
  PosShiftSummary,
  RecordPosShiftCashMovementRequest,
  RecordPosShiftCashMovementResponse,
} from '@waffarly/contracts';
import { apiRequest } from '../../lib/api-client.js';

export const posRegisterKey = (merchantId: string, branchId: string) =>
  ['pos', merchantId, branchId, 'registers'] as const;

export const posCurrentShiftKey = (merchantId: string, branchId: string, registerId: string) =>
  ['pos', merchantId, branchId, 'registers', registerId, 'current-shift'] as const;

export const posShiftReconciliationKey = (merchantId: string, shiftId: string) =>
  ['pos', merchantId, 'shifts', shiftId, 'reconciliation'] as const;

export const posLatestShiftCloseKey = (merchantId: string, registerId: string) =>
  ['pos', merchantId, 'registers', registerId, 'latest-close'] as const;

export function listPosRegisters(
  branchId: string,
  signal?: AbortSignal,
): Promise<PosRegisterOption[]> {
  const query = new URLSearchParams({ branchId });
  return apiRequest(`/pos/registers?${query.toString()}`, {
    method: 'GET',
    ...(signal ? { signal } : {}),
  });
}

export function getCurrentPosShift(
  registerId: string,
  signal?: AbortSignal,
): Promise<PosShiftSummary | null> {
  const query = new URLSearchParams({ registerId });
  return apiRequest(`/pos/shifts/current?${query.toString()}`, {
    method: 'GET',
    ...(signal ? { signal } : {}),
  });
}

export function openPosShift(input: OpenPosShiftRequest): Promise<PosShiftSummary> {
  return apiRequest('/pos/shifts/open', { method: 'POST', body: JSON.stringify(input) });
}

export function getPosShiftReconciliation(
  shiftId: string,
  signal?: AbortSignal,
): Promise<PosShiftLiveSummary> {
  return apiRequest(`/pos/shifts/${encodeURIComponent(shiftId)}/reconciliation`, {
    method: 'GET',
    ...(signal ? { signal } : {}),
  });
}

export function previewPosShiftClose(
  shiftId: string,
  request: PosShiftClosePreviewRequest,
): Promise<PosShiftClosePreview> {
  return apiRequest(`/pos/shifts/${encodeURIComponent(shiftId)}/close-preview`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function getLatestPosShiftClose(
  registerId: string,
  signal?: AbortSignal,
): Promise<PosShiftCloseReport | null> {
  const query = new URLSearchParams({ registerId });
  return apiRequest(`/pos/shifts/latest-close?${query.toString()}`, {
    method: 'GET',
    ...(signal ? { signal } : {}),
  });
}

export function recordPosShiftCashMovement(
  shiftId: string,
  request: Omit<RecordPosShiftCashMovementRequest, 'approval'>,
  approval?: NonNullable<RecordPosShiftCashMovementRequest['approval']>,
): Promise<RecordPosShiftCashMovementResponse> {
  return apiRequest(`/pos/shifts/${encodeURIComponent(shiftId)}/cash-movements`, {
    method: 'POST',
    body: JSON.stringify({ ...request, ...(approval ? { approval } : {}) }),
  });
}

export function closePosShift(
  shiftId: string,
  request: Omit<ClosePosShiftRequest, 'approval'>,
  approval?: NonNullable<ClosePosShiftRequest['approval']>,
): Promise<PosShiftCloseReport> {
  return apiRequest(`/pos/shifts/${encodeURIComponent(shiftId)}/close`, {
    method: 'POST',
    body: JSON.stringify({ ...request, ...(approval ? { approval } : {}) }),
  });
}
