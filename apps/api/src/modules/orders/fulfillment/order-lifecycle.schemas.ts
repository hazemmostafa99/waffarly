import { z } from 'zod';

export const acceptRecipeOrderSchema = z
  .object({ requestId: z.string().uuid(), branchId: z.string().uuid() })
  .strict();
export const startOrderPreparationSchema = z.object({ requestId: z.string().uuid() }).strict();
export const markOrderReadySchema = z.object({ requestId: z.string().uuid() }).strict();
export const markKitchenItemReadySchema = z.object({ requestId: z.string().uuid() }).strict();
export const handoverPosOrderSchema = z.object({ requestId: z.string().uuid() }).strict();
export const cancelRecipeOrderSchema = z
  .object({
    requestId: z.string().uuid(),
    restoreStock: z.boolean(),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export const cancelPosOrderSchema = z
  .object({
    requestId: z.string().uuid(),
    branchId: z.string().uuid(),
    reason: z.string().trim().min(1).max(500),
    approval: z
      .object({
        username: z.string().trim().min(1).max(80),
        password: z.string().min(1).max(256),
      })
      .strict()
      .optional(),
  })
  .strict();

export const cancelPosOrderCommandSchema = z
  .object({ requestId: z.string().uuid(), reason: z.string().trim().min(1).max(500) })
  .strict();

export const acknowledgePosKitchenCancellationSchema = z
  .object({ requestId: z.string().uuid() })
  .strict();
