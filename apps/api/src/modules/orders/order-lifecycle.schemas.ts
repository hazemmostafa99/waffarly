import { z } from 'zod';

export const acceptRecipeOrderSchema = z
  .object({ requestId: z.string().uuid(), branchId: z.string().uuid() })
  .strict();
export const startOrderPreparationSchema = z.object({ requestId: z.string().uuid() }).strict();
export const cancelRecipeOrderSchema = z
  .object({
    requestId: z.string().uuid(),
    restoreStock: z.boolean(),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
