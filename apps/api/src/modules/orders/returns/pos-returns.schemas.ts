/**
 * Checks the details for an item return and the dates and branch used in return reports.
 */
import type { RecordPosItemReturnRequest } from '@waffarly/contracts';
import { z } from 'zod';
import { parseRequest } from '../../../common/http/zod-validation.pipe.js';

const recordPosItemReturnSchema = z
  .object({
    requestId: z.string().uuid(),
    branchId: z.string().uuid(),
    reason: z.string().trim().min(2).max(500),
    lines: z
      .array(
        z
          .object({ orderLineId: z.string().uuid(), quantity: z.number().int().min(1).max(99) })
          .strict(),
      )
      .min(1)
      .max(30),
    approval: z
      .object({ username: z.string().trim().min(1).max(80), password: z.string().min(1).max(255) })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((request, context) => {
    if (new Set(request.lines.map((line) => line.orderLineId)).size !== request.lines.length) {
      context.addIssue({
        code: 'custom',
        path: ['lines'],
        message: 'Each original order line can be returned once per request.',
      });
    }
  });

export function parseRecordPosItemReturnRequest(input: unknown): RecordPosItemReturnRequest {
  return parseRequest(recordPosItemReturnSchema, input);
}

export function withoutPosItemReturnApproval(
  request: RecordPosItemReturnRequest,
): Omit<RecordPosItemReturnRequest, 'approval'> {
  const command = { ...request };
  delete command.approval;
  return command;
}

const reportTimestamp = z.string().datetime({ offset: true });
export const ownerPosItemReturnReportsSchema = z
  .object({
    branchId: z.string().uuid().optional(),
    from: reportTimestamp,
    to: reportTimestamp,
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict()
  .superRefine((query, context) => {
    const from = Date.parse(query.from);
    const to = Date.parse(query.to);
    if (to <= from) {
      context.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'End time must be after start time.',
      });
    } else if (to - from > 93 * 24 * 60 * 60 * 1000) {
      context.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'Report range cannot exceed 93 days.',
      });
    }
  });
export type OwnerPosItemReturnReportsInput = z.infer<typeof ownerPosItemReturnReportsSchema>;
