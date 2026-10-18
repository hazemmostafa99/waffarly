import { z } from 'zod';
import { POS_EMPLOYEE_ROLES } from '@waffarly/contracts';

const uuid = z.string().uuid();
const username = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9._-]+$/);
const branchIds = z
  .array(uuid)
  .max(100)
  .refine((ids) => new Set(ids).size === ids.length);

export const posLoginSchema = z
  .object({
    storefrontSlug: z.string().trim().toLowerCase().min(1).max(120),
    username,
    password: z.string().min(1).max(200),
  })
  .strict();

export const listPosEmployeesSchema = z
  .object({
    cursor: uuid.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(160).default(''),
    status: z.enum(['active', 'inactive', 'all']).default('all'),
  })
  .strict();
export type PosEmployeeListQuery = z.infer<typeof listPosEmployeesSchema>;

export const createPosEmployeeSchema = z
  .object({
    username,
    displayName: z.string().trim().min(2).max(160),
    password: z.string().min(12).max(200),
    role: z.enum(POS_EMPLOYEE_ROLES).nullable().optional(),
    branchIds,
  })
  .strict();

export const updatePosEmployeeSchema = z
  .object({
    revision: z.number().int().positive().max(2_147_483_646),
    displayName: z.string().trim().min(2).max(160),
    active: z.boolean(),
    role: z.enum(POS_EMPLOYEE_ROLES).nullable().optional(),
    branchIds,
    password: z.string().min(12).max(200).optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.active && input.branchIds.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['branchIds'],
        message: 'Assign at least one branch.',
      });
    }
  });
