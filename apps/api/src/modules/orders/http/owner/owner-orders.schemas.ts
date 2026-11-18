/** Validates the filters used to browse a merchant's order inbox. */
import { z } from 'zod';

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Choose a valid calendar date.');
const maxReportRangeDays = 93;

export const ownerOrderListQuerySchema = z
  .object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(25),
    status: z
      .enum(['pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled', 'rejected'])
      .optional(),
    source: z.enum(['waffarly', 'storefront', 'pos']).optional(),
    fulfillment: z.enum(['pickup', 'delivery', 'dine_in', 'takeaway']).optional(),
    from: date.optional(),
    to: date.optional(),
    search: z.string().trim().max(120).optional(),
    includeStats: z
      .string()
      .regex(/^(true|false)$/)
      .transform((value) => value === 'true')
      .default(true),
    report: z
      .string()
      .regex(/^(true|false)$/)
      .transform((value) => value === 'true')
      .optional(),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    path: ['to'],
    message: 'The end date must be the same as or later than the start date.',
  })
  .refine((query) => !query.report || Boolean(query.from && query.to), {
    path: ['to'],
    message: 'Choose a start and end date for the report.',
  })
  .refine(
    (query) =>
      !query.report ||
      !query.from ||
      !query.to ||
      Date.parse(`${query.to}T00:00:00.000Z`) - Date.parse(`${query.from}T00:00:00.000Z`) <
        maxReportRangeDays * 86_400_000,
    {
      path: ['to'],
      message: `Report date ranges cannot exceed ${maxReportRangeDays} days.`,
    },
  );

export type OwnerOrderListQuery = z.infer<typeof ownerOrderListQuerySchema>;
