/** Checks the username and credentials entered when a cashier signs in. */
import { z } from 'zod';
export const posUsernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9._-]+$/);
export const posLoginSchema = z
  .object({
    storefrontSlug: z.string().trim().toLowerCase().min(1).max(120),
    username: posUsernameSchema,
    password: z.string().min(1).max(200),
  })
  .strict();
