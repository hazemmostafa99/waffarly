import { z } from 'zod';

const fields = {
  name: z.string().trim().min(1).max(120),
  phone: z
    .string()
    .trim()
    .min(7)
    .max(32)
    .regex(/^[+\d\s().-]+$/)
    .refine((value) => value.replace(/\D/g, '').length >= 7)
    .nullable(),
  email: z
    .email()
    .max(254)
    .transform((value) => value.toLowerCase())
    .nullable(),
  notes: z.string().trim().max(2000),
  segment: z.enum(['regular', 'vip']),
};
export const customerListSchema = z
  .object({
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(120).default(''),
    status: z.enum(['active', 'archived', 'all']).default('active'),
  })
  .strict();
export type CustomerListQuery = z.infer<typeof customerListSchema>;
export const createCustomerSchema = z
  .object({
    requestId: z.uuid(),
    name: fields.name,
    phone: fields.phone.optional(),
    email: fields.email.optional(),
    notes: fields.notes.optional(),
    segment: fields.segment.optional(),
  })
  .strict();
export const updateCustomerSchema = z
  .object({
    revision: z.number().int().min(1).max(2_147_483_646),
    name: fields.name.optional(),
    phone: fields.phone.optional(),
    email: fields.email.optional(),
    notes: fields.notes.optional(),
    segment: fields.segment.optional(),
    archived: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).some((key) => key !== 'revision'),
    'An update is required.',
  );
