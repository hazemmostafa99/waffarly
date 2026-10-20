import type {
  RecordPosCheckPaymentRequest,
  RecordPosCheckRefundRequest,
} from '@waffarly/contracts';
import { z } from 'zod';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';

const amountSchema = z.string().regex(/^(?=.*[1-9])\d{1,10}(?:\.\d{1,2})?$/);

const tenderSchema = z.discriminatedUnion('method', [
  z
    .object({
      method: z.literal('cash'),
      amount: amountSchema,
      receivedAmount: amountSchema,
    })
    .strict(),
  z
    .object({
      method: z.literal('terminal'),
      amount: amountSchema,
      terminalReference: z
        .string()
        .trim()
        .min(1)
        .max(80)
        .refine((value) => !/^\d{12,19}$/.test(value.replace(/[\s-]/g, '')))
        .optional(),
    })
    .strict(),
]);

const recordPosCheckPaymentSchema = z
  .object({
    requestId: z.string().uuid(),
    revision: z.number().int().min(1),
    tenders: z.array(tenderSchema).min(1).max(4),
  })
  .strict();

const refundAllocationSchema = z
  .object({
    paymentId: z.string().uuid(),
    amount: amountSchema,
    terminalReference: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .refine((value) => !/^\d{12,19}$/.test(value.replace(/[\s-]/g, '')))
      .optional(),
  })
  .strict();

const recordPosCheckRefundSchema = z
  .object({
    requestId: z.string().uuid(),
    revision: z.number().int().min(1),
    branchId: z.string().uuid(),
    refundShiftId: z.string().uuid(),
    reason: z.string().trim().min(1).max(500),
    allocations: z.array(refundAllocationSchema).min(1).max(20),
    approval: z
      .object({ username: z.string().trim().min(1).max(80), password: z.string().min(1).max(256) })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((request, context) => {
    if (new Set(request.allocations.map((allocation) => allocation.paymentId)).size !== request.allocations.length) {
      context.addIssue({ code: 'custom', path: ['allocations'], message: 'Original payment IDs must be unique.' });
    }
  });

export function parseRecordPosCheckPaymentRequest(input: unknown): RecordPosCheckPaymentRequest {
  return parseRequest(recordPosCheckPaymentSchema, input) as RecordPosCheckPaymentRequest;
}

export function parseRecordPosCheckRefundRequest(input: unknown): RecordPosCheckRefundRequest {
  return parseRequest(recordPosCheckRefundSchema, input) as RecordPosCheckRefundRequest;
}

export function withoutPosRefundApproval(
  input: RecordPosCheckRefundRequest,
): Omit<RecordPosCheckRefundRequest, 'approval'> {
  return {
    requestId: input.requestId,
    revision: input.revision,
    branchId: input.branchId,
    refundShiftId: input.refundShiftId,
    reason: input.reason,
    allocations: input.allocations,
  };
}
