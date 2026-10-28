import { z } from 'zod';

export const updateMerchantAccountSchema = z
  .object({
    merchantName: z.string().trim().min(1).max(160),
    contactPhone: z.string().trim().min(3).max(32),
    ownerName: z.string().trim().min(1).max(160),
    ownerMobile: z.string().trim().min(3).max(32),
    revision: z.number().int().positive(),
  })
  .strict();

export const ownerSubscriptionHistorySchema = z.object({ cursor: z.uuid().optional() }).strict();
