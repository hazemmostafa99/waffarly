/**
 * Checks that the employee and branch may change this order.
 * Cashier cancellation also requires the current operator or supervisor permissions.
 */
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { isPosEmployeeRole, resolvePosEmployeePermissions } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';

import type { OrderTransitionCommand, PosCancellationActor } from './order-transition.types.js';

export async function assertOrderTransitionAccess(
  tx: Prisma.TransactionClient,
  merchantId: string,
  orderId: string,
  command: OrderTransitionCommand,
  branchId?: string,
  posCancelActor?: PosCancellationActor,
): Promise<void> {
  // Check routed online-order scope before returning any saved retry result.
  if (branchId) {
    const target = await tx.storefrontOrder.findFirst({
      where: { id: orderId, merchantId },
      select: { source: true, branchId: true },
    });
    if (
      (target?.source === 'storefront' || target?.source === 'waffarly') &&
      target.branchId
    ) {
      const branch = await tx.branch.findFirst({
        where: { id: target.branchId, merchantId, archivedAt: null },
        select: { id: true },
      });
      if (!branch || branchId !== target.branchId)
        throw new NotFoundException('Order was not found.');
      if (command.action === 'accept' && command.input.branchId !== target.branchId)
        throw new ConflictException('Accept this order at its receiving branch.');
    }
  }

  if (branchId && command.action === 'accept' && branchId !== command.input.branchId)
    throw new ForbiddenException('This employee is not assigned to the selected branch.');
  if (
    branchId &&
    (command.action === 'prepare' ||
      command.action === 'ready' ||
      command.action === 'ready_item' ||
      command.action === 'handover')
  ) {
    const routed = await tx.storefrontOrder.findFirst({
      where: {
        id: orderId,
        merchantId,
        branchId,
        OR: [
          { source: 'pos', kitchenTicket: { isNot: null } },
          { source: { in: ['waffarly', 'storefront'] }, branchId: { not: null } },
          { lines: { some: { stockHandling: { in: ['recipe_acceptance', 'direct_acceptance'] } } } },
        ],
      },
      select: { id: true },
    });
    if (!routed) throw new NotFoundException('Order was not found.');
  }
  if (command.action === 'pos_cancel') {
    if (
      !posCancelActor ||
      command.branchId !== posCancelActor.branchId ||
      branchId !== posCancelActor.branchId
    )
      throw new ForbiddenException('This employee is not assigned to the selected branch.');
    const actorEmployee = await tx.posEmployee.findFirst({
      where: {
        id: posCancelActor.employeeId,
        merchantId,
        active: true,
        branchId: posCancelActor.branchId,
        branch: { archivedAt: null },
      },
      select: { role: true, permissions: true },
    });
    const actorPermissions = actorEmployee
      ? resolvePosEmployeePermissions(
          isPosEmployeeRole(actorEmployee.role) ? actorEmployee.role : null,
          actorEmployee.permissions,
        )
      : [];
    if (!actorEmployee || !actorPermissions.includes('sell'))
      throw new ForbiddenException('This employee is no longer authorized to sell.');
    if (!command.approverEmployeeId && !actorPermissions.includes('approve_voids'))
      throw new ForbiddenException('Supervisor approval is required to cancel this order.');
    if (command.approverEmployeeId) {
      if (command.approverEmployeeId === posCancelActor.employeeId)
        throw new ForbiddenException('A different supervisor must approve this action.');
      const approver = await tx.posEmployee.findFirst({
        where: {
          id: command.approverEmployeeId,
          merchantId,
          active: true,
          branchId: posCancelActor.branchId,
          branch: { archivedAt: null },
        },
        select: { role: true, permissions: true },
      });
      const approverPermissions = approver
        ? resolvePosEmployeePermissions(
            isPosEmployeeRole(approver.role) ? approver.role : null,
            approver.permissions,
          )
        : [];
      if (!approver || !approverPermissions.includes('approve_voids'))
        throw new ForbiddenException('The supervisor approval is no longer valid.');
    }
  }
}
