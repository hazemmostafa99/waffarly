/**
 * Checks whether the employee can use the dining tools at the selected branch.
 */
export { buildCheckValues } from '../billing/check-split.rules.js';
import { ForbiddenException } from '@nestjs/common';
import type { PosEmployeeSession } from '@waffarly/contracts';

export function assertDiningSellAccess(employee: PosEmployeeSession): void {
  if (!employee.permissions.includes('sell'))
    throw new ForbiddenException('This employee is not authorized to use POS dining.');
}

export function assertDiningBranchAccess(employee: PosEmployeeSession, branchId: string): void {
  if (employee.branch.id !== branchId || employee.branch.archivedAt !== null)
    throw new ForbiddenException('This employee is not assigned to the selected branch.');
}
