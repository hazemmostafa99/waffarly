/** Checks the details entered when listing, creating or updating staff accounts. */
import { posUsernameSchema } from '../auth/index.js';
import { z } from 'zod';
import { POS_EMPLOYEE_ROLES } from '@waffarly/contracts';

const uuid = z.string().uuid();
const branchIds = z
  .array(uuid)
  .max(100)
  .refine((ids) => new Set(ids).size === ids.length);

export const listPosEmployeesSchema = z
  .object({
    cursor: uuid.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(160).default(''),
    status: z.enum(['active', 'inactive', 'all']).default('all'),
    role: z.enum(POS_EMPLOYEE_ROLES).optional(),
  })
  .strict();
export type PosEmployeeListQuery = z.infer<typeof listPosEmployeesSchema>;

export const createPosEmployeeSchema = z
  .object({
    username: posUsernameSchema,
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
