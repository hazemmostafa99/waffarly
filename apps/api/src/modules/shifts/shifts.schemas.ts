import { z } from 'zod';

const uuid = z.string().uuid();
const registerName = z.string().trim().min(1).max(80);

export const ownerPosRegisterListSchema = z
  .object({
    branchId: uuid.optional(),
    cursor: uuid.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    status: z.enum(['active', 'inactive', 'all']).default('active'),
  })
  .strict();
export type OwnerPosRegisterListQuery = z.infer<typeof ownerPosRegisterListSchema>;

export const posRegisterListSchema = z.object({ branchId: uuid }).strict();
export type PosRegisterListQuery = z.infer<typeof posRegisterListSchema>;

export const posCurrentShiftSchema = z.object({ registerId: uuid }).strict();

export const createPosRegisterSchema = z.object({ branchId: uuid, name: registerName }).strict();

export const updatePosRegisterSchema = z
  .object({
    revision: z.number().int().positive().max(2_147_483_646),
    name: registerName,
    active: z.boolean(),
  })
  .strict();

export const openPosShiftSchema = z
  .object({
    registerId: uuid,
    requestId: uuid,
    openingFloat: z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/),
  })
  .strict();
