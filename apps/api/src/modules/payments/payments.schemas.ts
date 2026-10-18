import type { RecordPosCheckPaymentRequest } from '@waffarly/contracts';
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

export function parseRecordPosCheckPaymentRequest(input: unknown): RecordPosCheckPaymentRequest {
  return parseRequest(recordPosCheckPaymentSchema, input) as RecordPosCheckPaymentRequest;
}
