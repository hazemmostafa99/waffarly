import type { CashSafeSummary, InventoryBranch } from '@waffarly/contracts';
import { ApiError, apiRequest, apiRequestSingle } from '../../lib/api-client.js';

export type SavedCommand = { path: string; body: Record<string, string> };

export function readSavedCommand(key: string): SavedCommand | null {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null') as SavedCommand | null;
    return saved && typeof saved.path === 'string' && saved.body ? saved : null;
  } catch {
    return null;
  }
}

/** Persists cash commands before sending so an uncertain network result can be retried safely. */
export async function sendSavedCommand<T>(key: string, command: SavedCommand): Promise<T> {
  const saved = readSavedCommand(key);
  const selected = saved ?? command;
  if (
    saved &&
    (saved.path !== command.path || JSON.stringify(saved.body) !== JSON.stringify(command.body))
  ) {
    throw new Error('A previous cash action needs to be retried or reviewed first.');
  }
  localStorage.setItem(key, JSON.stringify(selected));
  try {
    const result = await apiRequestSingle<T>(selected.path, {
      method: 'POST',
      body: JSON.stringify(selected.body),
    });
    localStorage.removeItem(key);
    return result;
  } catch (cause) {
    if (cause instanceof ApiError && cause.statusCode >= 400 && cause.statusCode < 500) {
      localStorage.removeItem(key);
    }
    throw cause;
  }
}

export async function listBranches(): Promise<InventoryBranch[]> {
  return apiRequest<InventoryBranch[]>('/owner/inventory/branches?limit=100&status=active');
}

export async function listSafes(branchId: string): Promise<CashSafeSummary[]> {
  const query = new URLSearchParams({ branchId, limit: '50' });
  return apiRequest<CashSafeSummary[]>('/owner/pos/cash/safes?' + query.toString());
}

export function currentMonth(): string {
  const parts = cairoDateParts();
  return parts.year + '-' + parts.month;
}

export function localToday(): string {
  const parts = cairoDateParts();
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    day: '2-digit',
  }).format(new Date());
  return parts.year + '-' + parts.month + '-' + day;
}

function cairoDateParts(): { year: string; month: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  return {
    year: parts.find((part) => part.type === 'year')?.value ?? '',
    month: parts.find((part) => part.type === 'month')?.value ?? '',
  };
}

export function monthDays(month: string): number {
  const [year, value] = month.split('-').map(Number);
  return new Date(year!, value!, 0).getDate();
}

export function moneyValue(value: string): number {
  return Number(value || 0);
}

export function validPositiveMoney(value: string): boolean {
  return /^\d+(?:\.\d{1,2})?$/.test(value) && Number(value) > 0;
}

