/** Calculates the first-release monthly and daily payroll rules with integer cents. */
import { formatCents, toCents } from '../../common/money/money.js';

export interface PayrollStaffSource {
  id: string;
  displayName: string;
  startDate: string;
  endDate: string | null;
  branch: { name: string };
  payRates: Array<{ effectiveDate: string; basis: 'monthly' | 'daily'; amount: string }>;
}

export interface PayrollAttendanceSource {
  staffMemberId: string;
  attendanceDate: string;
  status: string;
}

export interface PayrollAdjustmentSource {
  id: string;
  staffMemberId: string;
  kind: 'addition' | 'deduction';
  amount: string;
  reason: string;
  createdBy: string;
  createdAt: Date;
}

export interface PayrollBaseResult {
  basePay: string;
  payBasis: 'monthly' | 'daily';
  presentDays: number;
  rateSnapshot: Array<{ effectiveDate: string; basis: 'monthly' | 'daily'; amount: string }>;
}

export function calculateBasePay(
  staff: PayrollStaffSource,
  monthStart: Date,
  monthEnd: Date,
  attendance: PayrollAttendanceSource[],
): PayrollBaseResult {
  const firstOfMonth = toDateOnly(monthStart);
  const lastOfMonth = toDateOnly(monthEnd);
  const firstEligibleDate = laterOf(staff.startDate, firstOfMonth);
  const lastEligibleDate = earlierOf(staff.endDate ?? lastOfMonth, lastOfMonth);
  const daysInMonth = BigInt(monthEnd.getUTCDate());
  const presentDates = attendance
    .filter(
      (entry) =>
        entry.staffMemberId === staff.id &&
        entry.status === 'present' &&
        entry.attendanceDate >= firstEligibleDate &&
        entry.attendanceDate <= lastEligibleDate,
    )
    .map((entry) => entry.attendanceDate);

  let totalCents = 0n;
  let newestBasis: 'monthly' | 'daily' | null = null;
  const rates = [...staff.payRates].sort((left, right) =>
    left.effectiveDate.localeCompare(right.effectiveDate),
  );
  for (let index = 0; index < rates.length; index += 1) {
    const rate = rates[index]!;
    const nextRate = rates[index + 1];
    const segmentStart = laterOf(rate.effectiveDate, firstEligibleDate);
    const segmentEnd = earlierOf(
      nextRate ? addCalendarDays(nextRate.effectiveDate, -1) : lastEligibleDate,
      lastEligibleDate,
    );
    if (segmentStart > segmentEnd) continue;
    newestBasis = rate.basis;
    const rateCents = toCents(rate.amount);
    if (rate.basis === 'monthly') {
      const segmentDays = BigInt(daysBetweenInclusive(segmentStart, segmentEnd));
      totalCents += roundRatio(rateCents * segmentDays, daysInMonth);
    } else {
      const workedDays = presentDates.filter(
        (attendanceDate) => attendanceDate >= segmentStart && attendanceDate <= segmentEnd,
      ).length;
      totalCents += rateCents * BigInt(workedDays);
    }
  }

  return {
    basePay: formatCents(totalCents),
    payBasis: newestBasis ?? rates.at(-1)?.basis ?? 'monthly',
    presentDays: presentDates.length,
    rateSnapshot: rates
      .filter((rate) => rate.effectiveDate <= lastOfMonth && rate.effectiveDate >= staff.startDate)
      .map((rate) => ({ ...rate })),
  };
}

export function addAmounts(...values: string[]): string {
  return formatCents(values.reduce((sum, value) => sum + toCents(value), 0n));
}

export function subtractAmount(left: string, right: string): string {
  const difference = toCents(left) - toCents(right);
  return formatCents(difference < 0n ? 0n : difference);
}

export function minAmount(...values: string[]): string {
  return formatCents(
    values.reduce(
      (minimum, value) => {
        const cents = toCents(value);
        return cents < minimum ? cents : minimum;
      },
      toCents(values[0] ?? '0'),
    ),
  );
}

function roundRatio(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / 2n) / denominator;
}

function daysBetweenInclusive(start: string, end: string): number {
  return Math.round((dateOnly(end).getTime() - dateOnly(start).getTime()) / 86_400_000) + 1;
}

function addCalendarDays(value: string, days: number): string {
  const date = dateOnly(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateOnly(date);
}

function laterOf(left: string, right: string): string {
  return left > right ? left : right;
}

function earlierOf(left: string, right: string): string {
  return left < right ? left : right;
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}
