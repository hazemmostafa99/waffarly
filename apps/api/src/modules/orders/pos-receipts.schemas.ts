import { z } from 'zod';

export const posReceiptHistoryQuerySchema = z
  .object({
    branchId: z.string().uuid(),
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(25),
  })
  .strict();

export type PosReceiptHistoryQuery = z.infer<typeof posReceiptHistoryQuerySchema>;
