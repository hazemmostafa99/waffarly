/** Validates owner requests for month-based staff attendance. */
import { z } from 'zod';

const uuid = z.string().uuid();
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const date = z.string().date();

export const attendanceMonthSchema = z.object({ month, branchId: uuid.optional() }).strict();
export const attendancePeriodParamSchema = z.object({ month }).strict();
export const setAttendanceSchema = z
  .object({
    branchId: uuid,
    staffMemberId: uuid,
    attendanceDate: date,
    status: z.enum(['present', 'absent', 'leave', 'rest']).nullable(),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export function attendanceMonthStart(value: string): Date {
  const parsed = attendancePeriodParamSchema.parse({ month: value });
  return new Date(`${parsed.month}-01T00:00:00.000Z`);
}
