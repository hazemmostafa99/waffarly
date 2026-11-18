/** Validates merchant expense records, monthly summaries and cash payments. */
import { z } from 'zod';

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const money = z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/);
const positiveMoney = money.refine((value) => /[1-9]/.test(value), 'Amount must be positive.');

export const listExpensesSchema = z
  .object({
    month,
    branchId: uuid.optional(),
    cursor: uuid.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
export const expenseMonthSchema = z.object({ month }).strict();
export const createExpenseSchema = z
  .object({
    branchId: uuid,
    incurredOn: date,
    category: z.string().trim().min(1).max(80),
    amount: positiveMoney,
    description: z.string().trim().min(1).max(500),
  })
  .strict();
export const updateExpenseSchema = createExpenseSchema
  .extend({
    revision: z.number().int().positive().max(2_147_483_646),
  })
  .strict();
export const recordExpensePaymentSchema = z
  .object({
    requestId: uuid,
    safeId: uuid,
    amount: positiveMoney,
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export function monthStartDate(value: string): Date {
  if (!month.safeParse(value).success) throw new Error('Month must use YYYY-MM format.');
  return new Date(`${value}-01T00:00:00.000Z`);
}
