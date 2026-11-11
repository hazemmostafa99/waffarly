import { z } from 'zod';

const money = z.string().regex(/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
});
export const discountInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(200).default(''),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9_-]{2,31}$/),
  type: z.enum(['percentage', 'fixed']),
  value: money,
  minimum: money,
  maximum: money,
  startDate: date,
  endDate: date,
  usageLimit: z.string().regex(/^[1-9]\d{0,8}$/).or(z.literal('')),
  branches: z.array(z.uuid()).max(200),
  terms: z.string().trim().max(2000).default(''),
  state: z.enum(['published', 'draft', 'paused']),
}).strict().superRefine((value, context) => {
  if (Number(value.value) <= 0 || (value.type === 'percentage' && Number(value.value) > 100))
    context.addIssue({ code: 'custom', path: ['value'], message: 'Discount value is invalid.' });
  if (value.type === 'percentage' && value.maximum && Number(value.maximum) <= 0)
    context.addIssue({ code: 'custom', path: ['maximum'], message: 'Maximum discount is invalid.' });
  if (value.type === 'fixed' && value.maximum)
    context.addIssue({ code: 'custom', path: ['maximum'], message: 'Fixed discounts do not accept a maximum.' });
  if (value.endDate < value.startDate)
    context.addIssue({ code: 'custom', path: ['endDate'], message: 'End date must follow start date.' });
  if (new Set(value.branches).size !== value.branches.length)
    context.addIssue({ code: 'custom', path: ['branches'], message: 'Branches must be unique.' });
});

export const createDiscountSchema = discountInputSchema.safeExtend({ requestId: z.uuid() });
export const updateDiscountSchema = discountInputSchema.safeExtend({
  revision: z.number().int().min(1).max(2_147_483_646),
});
export const discountListSchema = z.object({
  cursor: z.uuid().optional(), limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(120).default(''),
  status: z.enum(['all', 'active', 'scheduled', 'draft', 'expired', 'paused']).default('all'),
  type: z.enum(['all', 'percentage', 'fixed']).default('all'),
}).strict();
export type DiscountInput = z.infer<typeof discountInputSchema>;
export type DiscountListQuery = z.infer<typeof discountListSchema>;
