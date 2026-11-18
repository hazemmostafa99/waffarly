/** Validates owner commands for payroll runs, adjustments, advances and payout. */
import { z } from 'zod';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';

const uuid = z.string().uuid();
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const money = z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/);
const positiveMoney = money.refine((value) => /[1-9]/.test(value), 'Amount must be positive.');

export const createPayrollRunSchema = z.object({ month }).strict();
export const payrollMonthQuerySchema = z.object({ month }).strict();
export const createPayrollAdjustmentSchema = z
  .object({
    staffMemberId: uuid,
    kind: z.enum(['addition', 'deduction']),
    amount: positiveMoney,
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
export const createStaffAdvanceSchema = z
  .object({
    requestId: uuid,
    staffMemberId: uuid,
    safeId: uuid,
    amount: positiveMoney,
    installmentAmount: positiveMoney,
    firstInstallmentMonth: month,
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
export const listStaffAdvancesSchema = z
  .object({ staffMemberId: uuid.optional(), status: z.enum(['open', 'all']).default('open') })
  .strict();
export const recordPayrollPaymentSchema = z
  .object({
    requestId: uuid,
    safeId: uuid,
    amount: positiveMoney,
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export function monthStartDate(value: string): Date {
  const parsed = parseRequest(z.object({ month }).strict(), { month: value });
  return new Date(`${parsed.month}-01T00:00:00.000Z`);
}

export function formatMonth(value: Date): string {
  return value.toISOString().slice(0, 7);
}
