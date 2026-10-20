import { POS_APPEARANCE_ACCENTS } from '@waffarly/contracts';
import { z } from 'zod';

export const updatePosAppearanceSchema = z.object({
  accent: z.enum(POS_APPEARANCE_ACCENTS),
  revision: z.number().int().positive(),
});
