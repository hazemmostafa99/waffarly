import type { OpenPosShiftRequest, PosRegisterOption, PosShiftSummary } from '@waffarly/contracts';
import { apiRequest } from '../../lib/api-client.js';

export const posRegisterKey = (merchantId: string, branchId: string) =>
  ['pos', merchantId, branchId, 'registers'] as const;

export const posCurrentShiftKey = (merchantId: string, branchId: string, registerId: string) =>
  ['pos', merchantId, branchId, 'registers', registerId, 'current-shift'] as const;

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
