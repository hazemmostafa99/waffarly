import { z } from 'zod';
export const subscriptionMonthsSchema = z.union([
  z.literal(1),
  z.literal(3),
  z.literal(6),
  z.literal(12),
  z.literal(24),
]);
export const subscriptionQuoteSchema = z
  .object({
    action: z.enum(['activate', 'renew', 'change']),
    planId: z.uuid(),
    months: subscriptionMonthsSchema,
  })
  .strict();
export const subscriptionCommandSchema = z
  .object({
    requestId: z.uuid(),
    revision: z.number().int().positive().max(2147483646),
    reason: z.string().trim().min(1).max(1000),
    action: z.enum([
      'assign',
      'activate',
      'renew',
      'change',
      'suspend',
      'resume',
      'cancel',
      'cancel-at-end',
      'keep-active',
    ]),
    planId: z.uuid().optional(),
    months: subscriptionMonthsSchema.optional(),
    planRevision: z.number().int().positive().optional(),
    externalCollectionConfirmed: z.literal(true).optional(),
    expectedDue: z
      .string()
      .regex(/^(?:0|[1-9]\d{0,7})\.\d{2}$/)
      .optional(),
    effectiveAt: z.iso.datetime().optional(),
  })
  .strict();
