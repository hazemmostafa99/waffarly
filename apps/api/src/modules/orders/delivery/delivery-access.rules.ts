/**
 * Checks which employee can work on a delivery and who is responsible for its money.
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
    !employee.branches.some((branch) => branch.id === branchId && branch.archivedAt === null)
  )
    throw new ForbiddenException('This employee cannot manage deliveries at this branch.');
}
export function assertDeliveryCustodianAccess(
  employee: PosEmployeeSession,
  custodianId: string,
  permissions: readonly string[],
) {
  if (custodianId !== employee.id && !permissions.includes('approve_shift_close'))
    throw new ForbiddenException(
      'Only the responsible employee or a supervisor can manage this delivery.',
    );
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
      branches: { some: { branchId, branch: { archivedAt: null } } },
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
