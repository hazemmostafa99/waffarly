/**
 * Sends a dining order to the kitchen and lets kitchen staff acknowledge a cancellation.
 */
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AcknowledgePosKitchenCancellationRequest,
  DispatchPosKitchenOrderRequest,
  PosEmployeeSession,
  StorefrontOrderSummary,
} from '@waffarly/contracts';
import { isPosEmployeeRole, resolvePosEmployeePermissions } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { createHash } from 'node:crypto';
import {
  isSerializationConflict,
  isUniqueConstraintError,
} from '../../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { requireEmployeePermission } from '../../auth/index.js';
import { toSummary } from '../mapping/order.mapper.js';
import { createPosKitchenTicket, posKitchenTicketInclude } from './pos-kitchen.persistence.js';
import { parseDispatchPosKitchenOrderRequest } from '../pos-sales/pos-orders.schemas.js';
import { acknowledgePosKitchenCancellationSchema } from '../fulfillment/order-lifecycle.schemas.js';
import { parseRequest } from '../../../common/http/zod-validation.pipe.js';

const orderInclude = {
  kitchenTicket: posKitchenTicketInclude,
  diningSession: { select: { table: { select: { code: true } } } },
  lines: {
    orderBy: { position: 'asc' as const },
    include: {
      selections: {
        orderBy: [{ groupPosition: 'asc' as const }, { optionPosition: 'asc' as const }],
      },
      variantAttributes: { orderBy: { position: 'asc' as const } },
    },
  },
} satisfies Prisma.StorefrontOrderInclude;

@Injectable()
export class PosKitchenService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async dispatchDineInOrder(
    employee: PosEmployeeSession,
    orderId: string,
    input: unknown,
  ): Promise<StorefrontOrderSummary> {
    requireEmployeePermission(employee, 'sell');
    const request: DispatchPosKitchenOrderRequest = parseDispatchPosKitchenOrderRequest(input);
    const branchIds = employee.branches
      .filter((branch) => branch.archivedAt === null)
      .map((branch) => branch.id);
    if (!branchIds.length) throw new ForbiddenException('This employee has no active branches.');

    const actor = `pos:${employee.id}`;
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ action: 'pos_kitchen_dispatch', orderId }))
      .digest('hex');

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const locked = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT "id" FROM "storefront_orders"
            WHERE "id" = ${orderId}::uuid AND "merchantId" = ${employee.merchantId}::uuid
            FOR UPDATE`;
          if (locked.length !== 1) throw new NotFoundException('The POS order was not found.');

          const replay = await tx.storefrontOrderAction.findUnique({
            where: {
              merchantId_requestId: {
                merchantId: employee.merchantId,
                requestId: request.requestId,
              },
            },
          });
          if (replay) {
            if (replay.fingerprint !== fingerprint)
              throw new ConflictException(
                'This request ID was used for a different kitchen action.',
              );
            return replay.result as unknown as StorefrontOrderSummary;
          }

          const order = await tx.storefrontOrder.findFirst({
            where: {
              id: orderId,
              merchantId: employee.merchantId,
              source: 'pos',
              branchId: { in: branchIds },
            },
            include: orderInclude,
          });
          if (!order) throw new NotFoundException('The POS order was not found.');
          if (order.fulfillmentType !== 'dine_in')
            throw new ConflictException('Takeaway and delivery orders are sent automatically.');
          if (!order.kitchenTicket && order.status !== 'pending')
            throw new ConflictException('Only a pending dine-in round can be sent to the kitchen.');

          if (!order.kitchenTicket) {
            await createPosKitchenTicket(tx, {
              merchantId: employee.merchantId,
              branchId: order.branchId!,
              orderId,
              dispatchMode: 'manual',
              dispatchedByPosEmployeeId: employee.id,
            });
          }

          const summary = toSummary(
            await tx.storefrontOrder.findFirstOrThrow({
              where: { id: orderId, merchantId: employee.merchantId },
              include: orderInclude,
            }),
          );
          await tx.storefrontOrderAction.create({
            data: {
              merchantId: employee.merchantId,
              orderId,
              requestId: request.requestId,
              action: 'pos_kitchen_dispatch',
              fingerprint,
              result: summary as unknown as Prisma.InputJsonValue,
              createdBy: actor,
            },
          });
          return summary;
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (isUniqueConstraintError(error) || isSerializationConflict(error)) {
        const previous = await this.prisma.storefrontOrderAction.findUnique({
          where: {
            merchantId_requestId: { merchantId: employee.merchantId, requestId: request.requestId },
          },
        });
        if (previous) {
          if (previous.fingerprint !== fingerprint)
            throw new ConflictException('This request ID was used for a different kitchen action.');
          return previous.result as unknown as StorefrontOrderSummary;
        }
        if (isUniqueConstraintError(error))
          throw new ConflictException('This kitchen ticket changed. Refresh the order and retry.');
        throw new ConflictException(
          'This order changed. Refresh it before sending to the kitchen.',
        );
      }
      throw error;
    }
  }

  async acknowledgeCancellation(
    employee: PosEmployeeSession,
    orderId: string,
    input: unknown,
  ): Promise<StorefrontOrderSummary> {
    requireEmployeePermission(employee, 'accept_recipe_orders');
    const request = parseRequest(
      acknowledgePosKitchenCancellationSchema,
      input,
    ) as AcknowledgePosKitchenCancellationRequest;
    const branchIds = employee.branches
      .filter((branch) => branch.archivedAt === null)
      .map((branch) => branch.id);
    const actor = `pos:${employee.id}`;
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ action: 'pos_cancel_ack', orderId }))
      .digest('hex');
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const locked = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT "id" FROM "storefront_orders"
            WHERE "id" = ${orderId}::uuid AND "merchantId" = ${employee.merchantId}::uuid
            FOR UPDATE`;
          if (!locked.length) throw new NotFoundException('The POS order was not found.');
          const currentEmployee = await tx.posEmployee.findFirst({
            where: {
              id: employee.id,
              merchantId: employee.merchantId,
              active: true,
              branches: {
                some: {
                  merchantId: employee.merchantId,
                  branchId: { in: branchIds },
                  branch: { archivedAt: null },
                },
              },
            },
            select: { role: true, permissions: true },
          });
          const currentPermissions = currentEmployee
            ? resolvePosEmployeePermissions(
                isPosEmployeeRole(currentEmployee.role) ? currentEmployee.role : null,
                currentEmployee.permissions,
              )
            : [];
          if (!currentEmployee || !currentPermissions.includes('accept_recipe_orders'))
            throw new ForbiddenException(
              'This employee is no longer authorized to acknowledge tickets.',
            );
          const previous = await tx.storefrontOrderAction.findUnique({
            where: {
              merchantId_requestId: {
                merchantId: employee.merchantId,
                requestId: request.requestId,
              },
            },
          });
          if (previous) {
            if (
              previous.action !== 'pos_cancel_ack' ||
              previous.createdBy !== actor ||
              previous.fingerprint !== fingerprint
            )
              throw new ConflictException('This request ID was used for a different order action.');
            return previous.result as unknown as StorefrontOrderSummary;
          }
          const order = await tx.storefrontOrder.findFirst({
            where: {
              id: orderId,
              merchantId: employee.merchantId,
              source: 'pos',
              branchId: { in: branchIds },
              status: 'cancelled',
              kitchenTicket: { isNot: null },
            },
            include: orderInclude,
          });
          if (!order) throw new NotFoundException('The cancelled kitchen ticket was not found.');
          if (order.kitchenTicket?.cancellationAcknowledgedAt)
            throw new ConflictException('This kitchen cancellation was already acknowledged.');
          const acknowledgedAt = new Date();
          const updated = await tx.posKitchenTicket.updateMany({
            where: {
              orderId,
              merchantId: employee.merchantId,
              cancellationAcknowledgedAt: null,
            },
            data: {
              cancellationAcknowledgedAt: acknowledgedAt,
              cancellationAcknowledgedByPosEmployeeId: employee.id,
            },
          });
          if (updated.count !== 1)
            throw new ConflictException('This kitchen cancellation changed. Refresh and retry.');
          const summary = toSummary(
            await tx.storefrontOrder.findFirstOrThrow({
              where: { id: orderId, merchantId: employee.merchantId },
              include: orderInclude,
            }),
          );
          await tx.storefrontOrderAction.create({
            data: {
              merchantId: employee.merchantId,
              orderId,
              requestId: request.requestId,
              action: 'pos_cancel_ack',
              fingerprint,
              result: summary as unknown as Prisma.InputJsonValue,
              createdBy: actor,
            },
          });
          return summary;
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (isUniqueConstraintError(error) || isSerializationConflict(error)) {
        const previous = await this.prisma.storefrontOrderAction.findUnique({
          where: {
            merchantId_requestId: { merchantId: employee.merchantId, requestId: request.requestId },
          },
        });
        if (previous) {
          if (
            previous.action !== 'pos_cancel_ack' ||
            previous.createdBy !== actor ||
            previous.fingerprint !== fingerprint
          )
            throw new ConflictException('This request ID was used for a different order action.');
          return previous.result as unknown as StorefrontOrderSummary;
        }
        throw new ConflictException('The kitchen cancellation changed. Refresh and retry.');
      }
      throw error;
    }
  }
}
