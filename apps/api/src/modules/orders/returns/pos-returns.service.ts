/**
 * Records approved physical item returns against the original sale.
 * These records describe waste; they do not refund money or put items back into stock.
 */
import {
  itemReturnInclude,
  toItemReturnSummary,
  type ItemReturnRecord,
} from './item-return.mapper.js';
import { listItemReturnReports, readOrderReturnsState } from './item-return.queries.js';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CursorPage,
  OwnerPosItemReturnReportRow,
  PosEmployeeSession,
  PosItemReturnSummary,
  PosOrderReturnsState,
  RecordPosItemReturnResponse,
  RecordPosItemReturnRequest,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { createHash, randomUUID } from 'node:crypto';
import { formatCents, toCents } from '../../../common/money/money.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { isPosEmployeeRole, resolvePosEmployeePermissions } from '@waffarly/contracts';

import { type OwnerPosItemReturnReportsInput } from './pos-returns.schemas.js';

@Injectable()
export class PosReturnsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  listOwnerReports(
    merchantId: string,
    input: OwnerPosItemReturnReportsInput,
  ): Promise<CursorPage<OwnerPosItemReturnReportRow>> {
    return listItemReturnReports(this.prisma, merchantId, input);
  }

  async state(employee: PosEmployeeSession, orderId: string): Promise<PosOrderReturnsState> {
    this.requireSell(employee);
    return readOrderReturnsState(this.prisma, employee, orderId);
  }

  async record(
    employee: PosEmployeeSession,
    orderId: string,
    input: Omit<RecordPosItemReturnRequest, 'approval'>,
    approverEmployeeId?: string,
  ): Promise<RecordPosItemReturnResponse> {
    this.requireSell(employee);
    const actor = `pos:${employee.id}`;
    // 1. Remember the exact return request and who submitted it.
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ orderId, ...input, approverEmployeeId: approverEmployeeId ?? null }))
      .digest('hex');

    return this.prisma.$transaction(async (tx) => {
      const activeBranchIds = employee.branches
        .filter((branch) => branch.archivedAt === null)
        .map((branch) => branch.id);
      if (!activeBranchIds.includes(input.branchId))
        throw new ForbiddenException('This employee is not assigned to the selected branch.');

      // 2. Recheck the employee and any supervisor approval before recording a return.
      const actorRow = await tx.posEmployee.findFirst({
        where: {
          id: employee.id,
          merchantId: employee.merchantId,
          active: true,
          branches: {
            some: {
              merchantId: employee.merchantId,
              branchId: input.branchId,
              branch: { archivedAt: null },
            },
          },
        },
        select: { displayName: true, role: true, permissions: true },
      });
      const actorPermissions = actorRow
        ? resolvePosEmployeePermissions(
            isPosEmployeeRole(actorRow.role) ? actorRow.role : null,
            actorRow.permissions,
          )
        : [];
      if (!actorRow || !actorPermissions.includes('sell'))
        throw new ForbiddenException('This employee is no longer authorized to record returns.');
      if (!approverEmployeeId && !actorPermissions.includes('approve_refunds'))
        throw new ForbiddenException('Supervisor approval is required to record this return.');

      const previous = await tx.posOrderItemReturn.findUnique({
        where: {
          merchantId_requestId: { merchantId: employee.merchantId, requestId: input.requestId },
        },
        include: itemReturnInclude,
      });
      if (previous) {
        const savedReturn = this.replay(previous, orderId, actor, fingerprint);
        return {
          orderId,
          return: savedReturn,
          state: await readOrderReturnsState(tx, employee, orderId),
        };
      }

      let approverName: string | null = null;
      if (approverEmployeeId) {
        if (approverEmployeeId === employee.id)
          throw new ForbiddenException('A different supervisor must approve this return.');
        const approver = await tx.posEmployee.findFirst({
          where: {
            id: approverEmployeeId,
            merchantId: employee.merchantId,
            active: true,
            branches: {
              some: {
                merchantId: employee.merchantId,
                branchId: input.branchId,
                branch: { archivedAt: null },
              },
            },
          },
          select: { displayName: true, role: true, permissions: true },
        });
        const approverPermissions = approver
          ? resolvePosEmployeePermissions(
              isPosEmployeeRole(approver.role) ? approver.role : null,
              approver.permissions,
            )
          : [];
        if (!approver || !approverPermissions.includes('approve_refunds'))
          throw new ForbiddenException('The supervisor approval is no longer valid.');
        approverName = approver.displayName;
      }

      const orderLock = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "storefront_orders"
        WHERE "id" = ${orderId}::uuid
          AND "merchantId" = ${employee.merchantId}::uuid
          AND "branchId" = ${input.branchId}::uuid
          AND "source" = 'pos'
        FOR UPDATE`;
      if (!orderLock.length) throw new NotFoundException('The POS order was not found.');

      // Recheck after taking the order lock so concurrent retries of the same command
      // observe the committed return instead of racing its unique request ID.
      const lockedReplay = await tx.posOrderItemReturn.findUnique({
        where: {
          merchantId_requestId: { merchantId: employee.merchantId, requestId: input.requestId },
        },
        include: itemReturnInclude,
      });
      if (lockedReplay) {
        const savedReturn = this.replay(lockedReplay, orderId, actor, fingerprint);
        return {
          orderId,
          return: savedReturn,
          state: await readOrderReturnsState(tx, employee, orderId),
        };
      }

      const order = await tx.storefrontOrder.findFirst({
        where: {
          id: orderId,
          merchantId: employee.merchantId,
          branchId: input.branchId,
          source: 'pos',
        },
        select: { id: true, status: true, completedAt: true, currency: true },
      });
      if (!order) throw new NotFoundException('The POS order was not found.');
      if (order.status !== 'completed' || !order.completedAt)
        throw new ConflictException(
          'Items can only be returned after the order has been handed over.',
        );

      const lines = await tx.storefrontOrderLine.findMany({
        where: { orderId, merchantId: employee.merchantId },
        include: {
          selections: { orderBy: [{ groupPosition: 'asc' }, { optionPosition: 'asc' }] },
        },
      });
      const lineById = new Map(lines.map((line) => [line.id, line]));
      const returned = await tx.posOrderItemReturnLine.groupBy({
        by: ['orderLineId'],
        where: { merchantId: employee.merchantId, orderId },
        _sum: { quantity: true },
      });
      const returnedByLine = new Map(
        returned.map((row) => [row.orderLineId, row._sum.quantity ?? 0]),
      );
      let totalCents = 0n;
      const returnLines = input.lines.map((requested) => {
        const line = lineById.get(requested.orderLineId);
        if (!line) throw new NotFoundException('An original POS order line was not found.');
        const alreadyReturned = returnedByLine.get(line.id) ?? 0;
        if (requested.quantity > line.quantity - alreadyReturned)
          throw new ConflictException('The requested quantity exceeds the units not yet returned.');
        const unitCents = toCents(line.unitPrice.toString());
        const amount = formatCents(unitCents * BigInt(requested.quantity));
        totalCents += unitCents * BigInt(requested.quantity);
        return {
          orderLineId: line.id,
          productName: line.productName,
          variantName: line.variantName,
          quantity: requested.quantity,
          disposition: 'waste' as const,
          unitPrice: formatCents(unitCents),
          amount,
        };
      });

      const returnId = randomUUID();
      const issuedAt = new Date();
      const returnNumber = `RET-${returnId.replaceAll('-', '').slice(0, 12).toUpperCase()}`;
      const summary: PosItemReturnSummary = {
        id: returnId,
        requestId: input.requestId,
        returnNumber,
        orderId,
        amount: formatCents(totalCents),
        currency: (order.currency || 'EGP') as 'EGP',
        reason: input.reason.trim(),
        issuedAt: issuedAt.toISOString(),
        createdByEmployeeId: employee.id,
        approvedByEmployeeId: approverEmployeeId ?? null,
        issuedBy: actorRow.displayName,
        approvedBy: approverName,
        lines: returnLines,
      };
      await tx.posOrderItemReturn.create({
        data: {
          id: returnId,
          merchantId: employee.merchantId,
          orderId,
          requestId: input.requestId,
          fingerprint,
          createdByEmployeeId: employee.id,
          approvedByEmployeeId: approverEmployeeId ?? null,
          returnNumber,
          reason: summary.reason,
          amount: summary.amount,
          currency: summary.currency,
          issuedAt,
          snapshot: summary as unknown as Prisma.InputJsonValue,
          lines: { create: returnLines },
        },
      });
      return {
        orderId,
        return: summary,
        state: await readOrderReturnsState(tx, employee, orderId),
      };
    });
  }

  private replay(
    record: ItemReturnRecord,
    orderId: string,
    actor: string,
    fingerprint: string,
  ): PosItemReturnSummary {
    if (
      record.orderId !== orderId ||
      record.createdByEmployeeId !== actor.slice('pos:'.length) ||
      record.fingerprint !== fingerprint
    )
      throw new ConflictException(
        'This return request ID was already used for a different command.',
      );
    return toItemReturnSummary(record);
  }

  private requireSell(employee: PosEmployeeSession): void {
    const current = employee.permissions.includes('sell');
    if (!current) throw new ForbiddenException('This employee cannot record POS item returns.');
  }
}
