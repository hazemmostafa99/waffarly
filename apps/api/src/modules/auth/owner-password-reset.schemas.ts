/** Validates a new owner password without normalizing characters or whitespace. */
import { z } from 'zod';

export const resetMerchantOwnerPasswordSchema = z
  .object({
    password: z.string().min(6).max(128),
  })
  .strict();
