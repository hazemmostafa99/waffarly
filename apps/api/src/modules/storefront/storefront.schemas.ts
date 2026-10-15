import { z } from 'zod';

export const saveSchema = z
  .object({
    templateId: z.string().uuid(),
    accentColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .transform((value) => value.toLowerCase()),
    logoData: z
      .string()
      .max(65_570)
      .regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]*={0,2}$/)
      .nullable(),
    revision: z.number().int().min(0).max(2147483646),
  })
  .strict();
