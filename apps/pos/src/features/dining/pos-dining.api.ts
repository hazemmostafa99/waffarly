import type {
  MovePosDiningSessionRequest,
  PosDiningSessionSummary,
  PosDiningTableOption,
  SplitPosOrderChecksRequest,
  SplitPosOrderChecksResponse,
} from '@waffarly/contracts';
import { apiRequest } from '../../lib/api-client.js';

export const posDiningTablesKey = (merchantId: string, branchId: string) =>
  ['pos', merchantId, 'dining', 'tables', branchId] as const;
export const posDiningSessionsKey = (merchantId: string, branchId: string) =>
  ['pos', merchantId, 'dining', 'sessions', branchId] as const;

export function getPosDiningTables(branchId: string, signal: AbortSignal) {
  const query = new URLSearchParams({ branchId });
  return apiRequest<PosDiningTableOption[]>(`/pos/dining/tables?${query}`, {
    method: 'GET',
    signal,
  });
}

export function getPosDiningSessions(branchId: string, signal: AbortSignal) {
  const query = new URLSearchParams({ branchId });
  return apiRequest<PosDiningSessionSummary[]>(`/pos/dining/sessions?${query}`, {
    method: 'GET',
    signal,
  });
}

export function movePosDiningSession(sessionId: string, input: MovePosDiningSessionRequest) {
  return apiRequest<PosDiningSessionSummary>(`/pos/dining/sessions/${sessionId}/move`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function splitPosOrderChecks(orderId: string, input: SplitPosOrderChecksRequest) {
  return apiRequest<SplitPosOrderChecksResponse>(`/pos/orders/${orderId}/split-checks`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
