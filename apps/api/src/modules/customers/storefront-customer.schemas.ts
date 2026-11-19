import { z } from 'zod';
import { normalizeCustomerPhone } from '../auth/index.js';

const revision = z.number().int().min(1).max(2_147_483_646);
export const storefrontCustomerAddressIdSchema = z.uuid();
const email = z.string().trim().toLowerCase().email().max(254);
const phone = z
  .string()
  .trim()
  .max(32)
  .transform(normalizeCustomerPhone)
  .pipe(z.string().regex(/^\+[1-9]\d{6,14}$/));

export const updateStorefrontCustomerProfileSchema = z
  .object({
    revision,
    name: z.string().trim().min(1).max(120).optional(),
    phone: phone.optional(),
    email: email.optional(),
    currentPassword: z.string().min(1).max(128).optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).some((key) => key !== 'revision' && key !== 'currentPassword'),
    'An update is required.',
  );

const addressFields = {
  label: z.string().trim().min(1).max(80),
  deliveryAreaId: z.string().trim().min(1).max(80),
  governorate: z.string().trim().max(80),
  locality: z.string().trim().max(120),
  area: z.string().trim().max(120),
  streetAddress: z.string().trim().min(5).max(500),
  notes: z.string().trim().max(500),
  isDefault: z.boolean(),
};

export const createStorefrontCustomerAddressSchema = z
  .object({
    ...addressFields,
    notes: addressFields.notes.optional(),
    isDefault: addressFields.isDefault.optional(),
  })
  .strict()
  .refine(
    (value) => Boolean(value.governorate || value.locality || value.area),
    'Choose a delivery area.',
  );

export const updateStorefrontCustomerAddressSchema = z
  .object({
    revision,
    label: addressFields.label.optional(),
    deliveryAreaId: addressFields.deliveryAreaId.optional(),
    governorate: addressFields.governorate.optional(),
    locality: addressFields.locality.optional(),
    area: addressFields.area.optional(),
    streetAddress: addressFields.streetAddress.optional(),
    notes: addressFields.notes.optional(),
    isDefault: addressFields.isDefault.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).some((key) => key !== 'revision'), 'An update is required.')
  .refine(
    (value) =>
      value.governorate === undefined ||
      value.locality === undefined ||
      value.area === undefined ||
      Boolean(value.governorate || value.locality || value.area),
    'Choose a delivery area.',
  );

export const deleteStorefrontCustomerAddressSchema = z.object({ revision }).strict();
