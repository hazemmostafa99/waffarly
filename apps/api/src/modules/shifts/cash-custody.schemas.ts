import { z } from 'zod';

const uuid = z.string().uuid();
const amount = z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/);
const positive = amount.refine((value) => /[1-9]/.test(value), 'Amount must be positive.');
export const cashPageSchema = z
  .object({
    branchId: uuid.optional(),
    safeId: uuid.optional(),
    shiftId: uuid.optional(),
    registerId: uuid.optional(),
    status: z.enum(['pending', 'received', 'discrepancy', 'resolved']).optional(),
    cursor: uuid.optional(),
    limit: z.coerce.number().int().min(1).max(50).default(25),
  })
  .strict();
export type CashPageQuery = z.infer<typeof cashPageSchema>;
export const createSafeSchema = z
  .object({
    requestId: uuid,
    branchId: uuid,
    name: z.string().trim().min(1).max(80),
    openingBalance: amount,
  })
  .strict();
export const transferCashSchema = z
  .object({
    requestId: uuid,
    safeId: uuid,
    amount: positive,
    reference: z.string().trim().min(1).max(80),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
export const receiveCashSchema = z
  .object({
    requestId: uuid,
    receivedAmount: amount,
    note: z.string().trim().max(500).default(''),
  })
  .strict();
export const resolveCashSchema = z.object({ note: z.string().trim().min(1).max(500) }).strict();
export const safeMovementSchema = z
  .object({
    requestId: uuid,
    kind: z.enum(['deposit', 'withdrawal']),
    amount: positive,
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
