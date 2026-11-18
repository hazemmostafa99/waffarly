/** Validates the owner report scope before any financial data is read. */
import { z } from 'zod';

export const businessReportQuerySchema = z
  .object({
    month: z.string().regex(/^(20\d{2})-(0[1-9]|1[0-2])$/),
    branchId: z.string().uuid().optional(),
  })
  .strict();

export type BusinessReportQuery = z.infer<typeof businessReportQuerySchema>;
