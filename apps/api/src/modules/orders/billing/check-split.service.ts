/**
 * Divides an order into bills by items, equal shares or chosen amounts.
 * It keeps the full order value accounted for and prevents changes after payment starts.
 */
import { hash, replayAction } from '../fulfillment/order-action.rules.js';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type {
  PosDiningSessionSummary,
  PosEmployeeSession,
  SplitPosOrderChecksRequest,
  SplitPosOrderChecksResponse,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';

import { toCents, formatCents } from '../../../common/money/money.js';

import { parseRequest } from '../../../common/http/zod-validation.pipe.js';
import {
  isSerializationConflict,
  isUniqueConstraintError,
} from '../../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { splitPosOrderChecksSchema } from '../dining/pos-dining.schemas.js';

import { buildCheckValues } from './check-split.rules.js';

@Injectable()
export class CheckSplitService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async splitOrder(
    employee: PosEmployeeSession,
    orderId: string,
    input: SplitPosOrderChecksRequest,
  ): Promise<SplitPosOrderChecksResponse> {
    if (!employee.permissions.includes('sell'))
      throw new ForbiddenException('This employee is not authorized to use POS dining.');
    const request = parseRequest(splitPosOrderChecksSchema, input) as SplitPosOrderChecksRequest;
    const actor = `pos:${employee.id}`;
    const fingerprint = hash(request);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const previous = await tx.storefrontOrderAction.findUnique({
            where: {
              merchantId_requestId: {
                merchantId: employee.merchantId,
                requestId: request.requestId,
              },
            },
          });
          if (previous)
            return replayAction<SplitPosOrderChecksResponse>(
              previous,
              actor,
              fingerprint,
              'dining_split',
            );
          await tx.$queryRaw`SELECT "id" FROM "storefront_orders" WHERE "id" = ${orderId}::uuid AND "merchantId" = ${employee.merchantId}::uuid FOR UPDATE`;
          const order = await tx.storefrontOrder.findFirst({
            where: {
              id: orderId,
              merchantId: employee.merchantId,
              source: 'pos',
              branchId: { in: employee.branches.map((branch) => branch.id) },
            },
            include: { lines: { orderBy: [{ position: 'asc' }, { id: 'asc' }] } },
          });
          if (!order) throw new NotFoundException('The POS order was not found.');
          if (order.revision !== request.revision)
            throw new ConflictException(
              'This order changed. Reload it before splitting the check.',
            );
          const recordedPayments = await tx.posOrderPayment.count({
            where: { orderId, merchantId: employee.merchantId },
          });
          if (recordedPayments > 0)
            throw new ConflictException('Check allocation is locked after payment begins.');
          // Keep the allocations and order revision in the same locked transaction.
          const checkValues = buildCheckValues(order.lines, order.total.toString(), request);
          await tx.posOrderCheckLine.deleteMany({
            where: { orderId, merchantId: employee.merchantId },
          });
          await tx.posOrderCheck.deleteMany({
            where: { orderId, merchantId: employee.merchantId },
          });
          for (const [position, check] of checkValues.entries()) {
            await tx.posOrderCheck.create({
              data: {
                orderId,
                merchantId: employee.merchantId,
                position,
                amount: formatCents(check.amountCents),
                splitMethod: request.method,
                ...(check.allocations.length
                  ? {
                      allocations: {
                        create: check.allocations.map((allocation) => ({
                          orderLine: {
                            connect: {
                              id_orderId_merchantId: {
                                id: allocation.orderLineId,
                                orderId,
                                merchantId: employee.merchantId,
                              },
                            },
                          },
                          quantity: allocation.quantity,
                          amount: formatCents(allocation.amountCents),
                        })),
                      },
                    }
                  : {}),
              },
            });
          }
          const updated = await tx.storefrontOrder.updateMany({
            where: { id: orderId, merchantId: employee.merchantId, revision: request.revision },
            data: { revision: { increment: 1 } },
          });
          if (updated.count !== 1)
            throw new ConflictException('This order changed. Reload it before splitting.');
          const response = await mapSplitResponse(tx, orderId, employee.merchantId);
          await tx.storefrontOrderAction.create({
            data: {
              merchantId: employee.merchantId,
              orderId,
              requestId: request.requestId,
              action: 'dining_split',
              fingerprint,
              result: response as unknown as Prisma.InputJsonValue,
              createdBy: actor,
            },
          });
          return response;
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
        if (previous)
          return replayAction<SplitPosOrderChecksResponse>(
            previous,
            actor,
            fingerprint,
            'dining_split',
          );
        if (isUniqueConstraintError(error))
          throw new ConflictException('The check split conflicts with a recent change.');
        throw new ConflictException('This order changed. Reload and retry the split.');
      }
      throw error;
    }
  }
}

async function mapSplitResponse(
  tx: Prisma.TransactionClient,
  orderId: string,
  merchantId: string,
): Promise<SplitPosOrderChecksResponse> {
  const [order, checks] = await Promise.all([
    tx.storefrontOrder.findFirstOrThrow({
      where: { id: orderId, merchantId },
      select: { revision: true },
    }),
    tx.posOrderCheck.findMany({
      where: { orderId, merchantId },
      orderBy: { position: 'asc' },
      include: {
        allocations: {
          include: { orderLine: { select: { id: true, productName: true, variantName: true } } },
        },
      },
    }),
  ]);
  return {
    orderId,
    revision: order.revision,
    checks: checks.map((check) => ({
      id: check.id,
      position: check.position,
      amount: formatCents(toCents(check.amount.toString())),
      splitMethod:
        check.splitMethod as PosDiningSessionSummary['orders'][number]['checks'][number]['splitMethod'],
      allocations: check.allocations.map((allocation) => ({
        orderLineId: allocation.orderLineId,
        productName: allocation.orderLine.productName,
        variantName: allocation.orderLine.variantName,
        quantity: allocation.quantity,
        amount: formatCents(toCents(allocation.amount.toString())),
      })),
    })),
  };
}
