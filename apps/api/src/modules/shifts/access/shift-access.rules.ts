/** Checks the employee, branch and supervisor permissions needed to work on a shift. */
import { ForbiddenException } from '@nestjs/common';

import {
  type PosEmployeeSession,
  isPosEmployeeRole,
  resolvePosEmployeePermissions,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';

export async function readCurrentShiftPermissions(
  tx: Prisma.TransactionClient,
  employee: PosEmployeeSession,
  branchId: string,
) {
  const current = await tx.posEmployee.findFirst({
    where: {
      id: employee.id,
      merchantId: employee.merchantId,
      active: true,
      branchId,
      branch: { archivedAt: null },
    },
    select: { role: true, permissions: true },
  });
  if (!current) throw new ForbiddenException('This employee is not active at the selected branch.');
  return resolvePosEmployeePermissions(
    isPosEmployeeRole(current.role) ? current.role : null,
    current.permissions,
  );
}

export async function requireCurrentApprover(
  tx: Prisma.TransactionClient,
  actor: PosEmployeeSession,
  branchId: string,
  approverEmployeeId: string,
  permission: 'approve_shift_close' | 'manage_cash_movements',
): Promise<string> {
  if (approverEmployeeId === actor.id)
    throw new ForbiddenException('A different supervisor must approve this action.');
  const approver = await tx.posEmployee.findFirst({
    where: {
      id: approverEmployeeId,
      merchantId: actor.merchantId,
      active: true,
      branchId,
      branch: { archivedAt: null },
    },
    select: { id: true, role: true, permissions: true },
  });
  if (!approver)
    throw new ForbiddenException('The approving employee is not active at this branch.');
  const permissions = resolvePosEmployeePermissions(
    isPosEmployeeRole(approver.role) ? approver.role : null,
    approver.permissions,
  );
  if (!permissions.includes(permission))
    throw new ForbiddenException('The approving employee does not have the required permission.');
  return approver.id;
}

export function assertShiftBranchAssignment(employee: PosEmployeeSession, branchId: string): void {
  if (employee.branch.id !== branchId) {
    throw new ForbiddenException('This employee is not assigned to the selected branch.');
  }
}

/** Keeps register operations on the one cashier station paired with this browser. */
export function assertPosRegisterAssignment(
  employee: PosEmployeeSession,
  registerId: string,
): void {
  // Old in-process callers may omit device state; authenticated POS sessions never do.
  if (employee.deviceRegister === undefined) return;
  if (!employee.deviceRegister) {
    throw new ForbiddenException('Pair this browser with a POS register before continuing.');
  }
  if (employee.deviceRegister.id !== registerId) {
    throw new ForbiddenException('This browser can only use its paired POS register.');
  }
}

export function assertCurrentPosRegisterPair(
  employee: PosEmployeeSession,
  registerId: string,
  deviceId: string | null,
): void {
  assertPosRegisterAssignment(employee, registerId);
  if (employee.deviceId !== undefined && employee.deviceId !== deviceId) {
    throw new ForbiddenException('This browser is no longer paired with the selected POS register.');
  }
}

export function requireShiftAccess(employee: PosEmployeeSession): void {
  if (!isPosEmployeeRole(employee.role) || !employee.permissions.includes('open_register_shift')) {
    throw new ForbiddenException('This employee is not authorized to use register shifts.');
  }
}
