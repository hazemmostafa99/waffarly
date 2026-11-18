/** Validates owner requests for staff profiles and pay-rate history. */
import { z } from 'zod';

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const money = z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/);
const positiveMoney = money.refine((value) => /[1-9]/.test(value), 'Amount must be positive.');

export const listStaffSchema = z
  .object({
    cursor: uuid.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    branchId: uuid.optional(),
    status: z.enum(['active', 'inactive', 'all']).default('active'),
    search: z.string().trim().max(160).default(''),
  })
  .strict();
export type StaffListQuery = z.infer<typeof listStaffSchema>;
export const staffPosEmployeeOptionsSchema = z.object({ branchId: uuid }).strict();

export const createStaffSchema = z
  .object({
    employeeNumber: z.string().trim().min(1).max(40).nullable().optional(),
    displayName: z.string().trim().min(2).max(160),
    jobTitle: z.string().trim().min(1).max(100),
    phone: z.string().trim().min(5).max(32).nullable().optional(),
    branchId: uuid,
    posEmployeeId: uuid.nullable().optional(),
    startDate: date,
    payBasis: z.enum(['monthly', 'daily']),
    payAmount: positiveMoney,
  })
  .strict();

export const updateStaffSchema = z
  .object({
    revision: z.number().int().positive().max(2_147_483_646),
    employeeNumber: z.string().trim().min(1).max(40).nullable().optional(),
    displayName: z.string().trim().min(2).max(160),
    jobTitle: z.string().trim().min(1).max(100),
    phone: z.string().trim().min(5).max(32).nullable().optional(),
    branchId: uuid,
    posEmployeeId: uuid.nullable().optional(),
    startDate: date,
    endDate: date.nullable().optional(),
    active: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.endDate && value.endDate < value.startDate) {
      context.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'End date must follow start date.',
      });
    }
    if (!value.active && !value.endDate) {
      context.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'Set the employee last working date before deactivation.',
      });
    }
  });

export const createStaffPayRateSchema = z
  .object({
    effectiveDate: date,
    basis: z.enum(['monthly', 'daily']),
    amount: positiveMoney,
  })
  .strict();
