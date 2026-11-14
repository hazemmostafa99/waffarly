import { z } from 'zod';

const base = { requestId: z.string().uuid(), revision: z.number().int().positive() };
export const posDeliveryCommandSchema = z.discriminatedUnion('action', [
  z
    .object({
      ...base,
      action: z.literal('dispatch'),
      courierName: z.string().trim().min(1).max(160),
    })
    .strict(),
  z.object({ ...base, action: z.literal('delivered') }).strict(),
  z
    .object({ ...base, action: z.literal('failed'), reason: z.string().trim().min(1).max(500) })
    .strict(),
  z.object({ ...base, action: z.literal('claim'), receivingShiftId: z.string().uuid() }).strict(),
  z
    .object({
      ...base,
      action: z.literal('remit'),
      receivingShiftId: z.string().uuid(),
      paymentId: z.string().uuid(),
      amount: z.string().regex(/^(?=.*[1-9])\d{1,10}(?:\.\d{1,2})?$/),
    })
    .strict(),
]);
export const posDeliveryListSchema = z
  .object({
    includeResolved: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    branchId: z.string().uuid(),
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
