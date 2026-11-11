import { z } from 'zod';

export function normalizeCustomerPhone(value: string): string {
  let phone = value
    .trim()
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/[\s()-]/g, '');
  if (phone.startsWith('00')) phone = `+${phone.slice(2)}`;
  if (/^01[0125]\d{8}$/.test(phone)) phone = `+20${phone.slice(1)}`;
  return phone;
}

const phone = z
  .string()
  .max(32)
  .transform(normalizeCustomerPhone)
  .pipe(z.string().regex(/^\+[1-9]\d{6,14}$/));
const email = z.string().trim().toLowerCase().max(254).email();

export const customerSignUpSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email,
    phone,
    password: z.string().min(8).max(128),
  })
  .strict();

export const customerSignInSchema = z
  .object({
    identifier: z
      .string()
      .trim()
      .min(1)
      .max(254)
      .transform((value) =>
        value.includes('@') ? value.toLowerCase() : normalizeCustomerPhone(value),
      )
      .pipe(z.union([email, z.string().regex(/^\+[1-9]\d{6,14}$/)])),
    password: z.string().min(1).max(128),
  })
  .strict();
