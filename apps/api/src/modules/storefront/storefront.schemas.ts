import { z } from 'zod';

const color = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .transform((value) => value.toLowerCase());

const logoData = z
  .string()
  .max(65_570)
  .nullable()
  .superRefine((value, context) => {
    if (!value) return;
    if (value.startsWith('data:')) {
      if (!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]*={0,2}$/.test(value)) {
        context.addIssue({ code: 'custom', message: 'Upload a valid PNG, JPG, or WebP image.' });
      }
      return;
    }
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol) || value.length > 2_000) throw new Error();
    } catch {
      context.addIssue({ code: 'custom', message: 'Use a valid HTTP or HTTPS image URL.' });
    }
  });

export const saveSchema = z
  .object({
    templateId: z.string().uuid(),
    primaryColor: color,
    accentColor: color,
    backgroundColor: color,
    surfaceColor: color,
    logoScale: z.enum(['small', 'medium', 'large']),
    logoData,
    revision: z.number().int().min(0).max(2147483646),
  })
  .strict();
