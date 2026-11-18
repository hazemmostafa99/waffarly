/**
 * Checks that employees can work on deliveries only at their active assigned branch.
 */
import { ForbiddenException } from '@nestjs/common';

import {
  isPosEmployeeRole,
  resolvePosEmployeePermissions,
  type PosEmployeeSession,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';

export function assertDeliveryBranchAccess(employee: PosEmployeeSession, branchId: string) {
  if (
    !employee.permissions.includes('sell') ||
    employee.branch.id !== branchId ||
    employee.branch.archivedAt !== null
  )
    throw new ForbiddenException('This employee cannot manage deliveries at this branch.');
}
export async function readCurrentDeliveryPermissions(
  tx: Prisma.TransactionClient,
  employee: PosEmployeeSession,
  branchId: string,
) {
  const actor = await tx.posEmployee.findFirst({
    where: {
      id: employee.id,
      merchantId: employee.merchantId,
      active: true,
      branchId,
      branch: { archivedAt: null },
    },
    select: { role: true, permissions: true },
  });
  const permissions = actor
    ? resolvePosEmployeePermissions(
        isPosEmployeeRole(actor.role) ? actor.role : null,
        actor.permissions,
      )
    : [];
  if (!permissions.includes('sell'))
    throw new ForbiddenException('This employee is no longer authorized to manage deliveries.');
  return permissions;
}
