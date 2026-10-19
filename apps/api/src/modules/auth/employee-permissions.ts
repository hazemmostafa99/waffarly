import { ForbiddenException } from '@nestjs/common';
import {
  hasPosEmployeePermission,
  type PosEmployeePermission,
  type PosEmployeeSession,
} from '@waffarly/contracts';

export function requireEmployeePermission(
  employee: PosEmployeeSession,
  permission: PosEmployeePermission,
): void {
  if (!hasPosEmployeePermission(employee, permission)) {
    throw new ForbiddenException('This employee is not authorized to perform this action.');
  }
}

export function requireEmployeeBranch(employee: PosEmployeeSession, branchId: string): void {
  if (!employee.branches.some((branch) => branch.id === branchId)) {
    throw new ForbiddenException('This employee is not assigned to the selected branch.');
  }
}
