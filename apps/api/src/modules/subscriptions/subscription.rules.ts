import { BadRequestException } from '@nestjs/common';
import { formatCents, toCents } from '../../common/money/money.js';
import type { SubscriptionStatus } from '@waffarly/contracts';

export function effectiveSubscriptionStatus(
  status: string,
  hasCoverage: boolean,
): SubscriptionStatus {
  return status === 'active' && !hasCoverage ? 'expired' : (status as SubscriptionStatus);
}

const cairo = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Cairo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
function localParts(date: Date) {
  const parts = Object.fromEntries(
    cairo.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Calendar months in Cairo, clamped to the last day of the target month. */
export function addSubscriptionMonths(start: Date, months: number): Date {
  const p = localParts(start);
  const targetMonth = new Date(Date.UTC(p.year, p.month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const wall = Date.UTC(
    targetMonth.getUTCFullYear(),
    targetMonth.getUTCMonth(),
    Math.min(p.day, lastDay),
    p.hour,
    p.minute,
    p.second,
    start.getUTCMilliseconds(),
  );
  const represented = (instant: number) => {
    const actual = localParts(new Date(instant));
    return Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
      start.getUTCMilliseconds(),
    );
  };
  const offsets = new Set(
    [-86400000, 0, 86400000].map((delta) => represented(wall + delta) - (wall + delta)),
  );
  const candidates = [...offsets].map((offset) => wall - offset).sort((a, b) => a - b);
  // Earlier occurrence for repeated wall times; move forward across a spring gap.
  const exact = candidates.find((instant) => represented(instant) === wall);
  return new Date(
    exact ??
      candidates
        .filter((instant) => represented(instant) > wall)
        .sort((a, b) => represented(a) - represented(b))[0]!,
  );
}

export function unusedSubscriptionCredit(
  price: string,
  startsAt: Date,
  endsAt: Date,
  now: Date,
): string {
  const remaining = BigInt(
    Math.max(0, Math.min(endsAt.getTime() - now.getTime(), endsAt.getTime() - startsAt.getTime())),
  );
  const duration = BigInt(endsAt.getTime() - startsAt.getTime());
  if (duration <= 0n) throw new BadRequestException('Subscription period is invalid.');
  return formatCents((toCents(price) * remaining) / duration);
}

/** Inactive tenants can read records and finish existing work, but cannot start sales or shifts. */
export function isSubscriptionRecoveryRequest(method: string, path: string): boolean {
  const clean = (path ?? '').split('?')[0] ?? '';
  if (method === 'GET' || method === 'HEAD') return true;
  if (method !== 'POST' && method !== 'PATCH') return false;
  return (
    /^\/pos\/shifts\/[^/]+\/(close|close-preview|cash-movements)$/.test(clean) ||
    /^\/pos\/orders\/[^/]+\/(?:checks\/[^/]+\/(?:payments|refunds)|cancel|accept|start-preparation|ready|handover|items\/[^/]+\/ready|cancellation-acknowledgement|kitchen-dispatch|split-checks)$/.test(
      clean,
    ) ||
    /^\/owner\/orders\/[^/]+\/(?:accept|start-preparation|ready|cancel|status)$/.test(clean) ||
    /^\/(?:pos|owner\/pos)\/cash\/(?:shifts\/[^/]+\/transfers|transfers\/[^/]+\/(?:receive|resolve)|safes\/[^/]+\/movements)$/.test(
      clean,
    ) ||
    /^\/pos\/deliveries\/[^/]+\/(?:actions|requests\/[^/]+\/abandon)$/.test(clean)
  );
}
