import { z } from 'zod';
import type {
  ClosePosShiftRequest,
  RecordPosShiftCashMovementRequest,
} from '@waffarly/contracts';

const uuid = z.string().uuid();
const registerName = z.string().trim().min(1).max(80);

export const ownerPosRegisterListSchema = z
  .object({
    branchId: uuid.optional(),
    cursor: uuid.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    status: z.enum(['active', 'inactive', 'all']).default('active'),
  })
  .strict();
export type OwnerPosRegisterListQuery = z.infer<typeof ownerPosRegisterListSchema>;

const reportTimestamp = z.string().datetime({ offset: true });
export const ownerPosShiftCloseReportsSchema = z
  .object({
    branchId: uuid.optional(),
    from: reportTimestamp,
    to: reportTimestamp,
    cursor: uuid.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict()
  .superRefine((query, context) => {
    const from = Date.parse(query.from);
    const to = Date.parse(query.to);
    if (to <= from) {
      context.addIssue({ code: 'custom', path: ['to'], message: 'End time must be after start time.' });
    } else if (to - from > 93 * 24 * 60 * 60 * 1000) {
      context.addIssue({ code: 'custom', path: ['to'], message: 'Report range cannot exceed 93 days.' });
    }
  });
export type OwnerPosShiftCloseReportsInput = z.infer<typeof ownerPosShiftCloseReportsSchema>;

export const posRegisterListSchema = z.object({ branchId: uuid }).strict();
export type PosRegisterListQuery = z.infer<typeof posRegisterListSchema>;

export const posCurrentShiftSchema = z.object({ registerId: uuid }).strict();

export const createPosRegisterSchema = z.object({ branchId: uuid, name: registerName }).strict();

export const updatePosRegisterSchema = z
  .object({
    revision: z.number().int().positive().max(2_147_483_646),
    name: registerName,
    active: z.boolean(),
  })
  .strict();

export const openPosShiftSchema = z
  .object({
    registerId: uuid,
    requestId: uuid,
    openingFloat: z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/),
  })
  .strict();

const approvalSchema = z
  .object({ username: z.string().trim().min(1).max(80), password: z.string().min(1).max(256) })
  .strict();
const positiveAmount = z.string().regex(/^(?=.*[1-9])\d{1,10}(?:\.\d{1,2})?$/);
const nonNegativeAmount = z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/);

export const recordPosShiftCashMovementSchema = z
  .object({
    requestId: uuid,
    kind: z.enum(['cash_in', 'cash_out', 'cash_drop']),
    amount: positiveAmount,
    reason: z.string().trim().min(1).max(500),
    dropReference: z.string().trim().min(1).max(80).optional(),
    approval: approvalSchema.optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.kind === 'cash_drop' && !input.dropReference) {
      context.addIssue({ code: 'custom', path: ['dropReference'], message: 'A cash-drop reference is required.' });
    }
    if (input.kind !== 'cash_drop' && input.dropReference !== undefined) {
      context.addIssue({ code: 'custom', path: ['dropReference'], message: 'A cash-drop reference applies only to cash drops.' });
    }
  });

export const closePosShiftSchema = z
  .object({
    requestId: uuid,
    countedCash: nonNegativeAmount,
    reason: z.string().trim().min(1).max(500).optional(),
    approval: approvalSchema.optional(),
  })
  .strict();

export const posShiftClosePreviewSchema = z
  .object({
    countedCash: nonNegativeAmount,
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();
export type PosShiftClosePreviewInput = z.infer<typeof posShiftClosePreviewSchema>;

export function withoutShiftCashMovementApproval(
  input: RecordPosShiftCashMovementRequest,
): Omit<RecordPosShiftCashMovementRequest, 'approval'> {
  return {
    requestId: input.requestId,
    kind: input.kind,
    amount: input.amount,
    reason: input.reason,
    ...(input.dropReference ? { dropReference: input.dropReference } : {}),
  };
}

export function withoutShiftCloseApproval(
  input: ClosePosShiftRequest,
): Omit<ClosePosShiftRequest, 'approval'> {
  return {
    requestId: input.requestId,
    countedCash: input.countedCash,
    ...(input.reason ? { reason: input.reason } : {}),
  };
}
