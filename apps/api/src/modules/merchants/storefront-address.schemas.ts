import { isStorefrontHandle } from '@waffarly/contracts';
import { z } from 'zod';

export const storefrontHandleSchema = z.string().trim().toLowerCase().refine(isStorefrontHandle, {
  message:
    'Use an available non-reserved name of 3–63 lowercase letters, digits or internal hyphens.',
});
export const assignStorefrontHandleSchema = z.object({ handle: storefrontHandleSchema }).strict();
