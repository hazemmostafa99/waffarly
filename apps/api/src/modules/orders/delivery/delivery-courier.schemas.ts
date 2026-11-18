/** Checks the details owners and POS staff use to find or manage delivery couriers. */
import { z } from 'zod';

const uuid = z.string().uuid();
const branchIds = z
  .array(uuid)
  .min(1)
  .max(100)
  .refine((ids) => new Set(ids).size === ids.length, 'Select each branch once.');
const courierFields = {
  name: z.string().trim().min(2).max(160),
  phone: z
    .string()
    .trim()
    .max(32)
    .nullable()
    .transform((phone) => phone || null),
  branchIds,
};

export const listDeliveryCouriersSchema = z
  .object({
    cursor: uuid.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(160).default(''),
    status: z.enum(['active', 'inactive', 'all']).default('all'),
  })
  .strict();

export const listPosDeliveryCouriersSchema = z
  .object({
    cursor: uuid.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const createDeliveryCourierSchema = z.object(courierFields).strict();

export const updateDeliveryCourierSchema = z
  .object({
    ...courierFields,
    revision: z.number().int().positive().max(2_147_483_646),
    active: z.boolean(),
  })
  .strict();
