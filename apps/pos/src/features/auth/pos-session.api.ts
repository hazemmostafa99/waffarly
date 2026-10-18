import type { PosEmployeeSession } from '@waffarly/contracts';
import { apiRequest } from '../../lib/api-client.js';

export const posSessionKey = ['pos', 'session'] as const;

export function getPosSession(signal?: AbortSignal): Promise<PosEmployeeSession> {
  return apiRequest('/auth/pos/me', { method: 'GET', ...(signal ? { signal } : {}) });
}

export function signOutPosEmployee(): Promise<void> {
  return apiRequest('/auth/pos/logout', { method: 'POST' });
}
