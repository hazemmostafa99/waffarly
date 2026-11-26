/** Checks the sign-in name and credentials entered when a cashier signs in. */
import { isStorefrontHandle, parsePosSignInName } from '@waffarly/contracts';
import { z } from 'zod';
export const posUsernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9._-]+$/);
/** "<store subdomain>.<username>", e.g. "ahmed-cafe.ali"; split by parsePosSignInName. */
const posSignInNameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(144)
  .refine(
    (value) => {
      const parts = parsePosSignInName(value);
      return (
        parts !== null &&
        isStorefrontHandle(parts.storefrontHandle) &&
        posUsernameSchema.safeParse(parts.username).success
      );
    },
    { message: 'Sign in as store-subdomain.username, for example ahmed-cafe.ali.' },
  );
export const posLoginSchema = z
  .object({
    login: posSignInNameSchema,
    password: z.string().min(1).max(200),
  })
  .strict();
