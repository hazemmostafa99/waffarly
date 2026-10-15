import type { CatalogProductQuoteRequest } from '@waffarly/contracts';
import { z } from 'zod';
import { parseRequest } from '../../../common/http/zod-validation.pipe.js';
const quoteSelectionSchema = z
  .object({
    groupId: z.string().uuid(),
    optionIds: z.array(z.string().uuid()).max(100),
  })
  .strict();
const quoteSchema = z
  .object({
    variantId: z.string().uuid().optional(),
    selections: z.array(quoteSelectionSchema).max(30).optional(),
  })
  .strict();
export function parseQuoteBody(body: unknown): CatalogProductQuoteRequest {
  const parsed = parseRequest(quoteSchema, body ?? {});
  return parsed;
}
