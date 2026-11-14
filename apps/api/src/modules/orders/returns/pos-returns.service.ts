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
import { assertScopedCursor } from '../../../common/http/pagination.js';
import { parseRequest } from '../../../common/http/zod-validation.pipe.js';
import {
  ownerPosItemReturnReportsSchema,
  type OwnerPosItemReturnReportsInput,
} from './pos-returns.schemas.js';

const itemReturnInclude = {
  createdBy: { select: { displayName: true } },
  approvedBy: { select: { displayName: true } },
  lines: { orderBy: [{ orderLineId: 'asc' as const }, { id: 'asc' as const }] },
} satisfies Prisma.PosOrderItemReturnInclude;

type ItemReturnRecord = Prisma.PosOrderItemReturnGetPayload<{
  include: typeof itemReturnInclude;
}>;

@Injectable()
export class PosReturnsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listOwnerReports(
    merchantId: string,
    input: OwnerPosItemReturnReportsInput,
  ): Promise<CursorPage<OwnerPosItemReturnReportRow>> {
    const query = parseRequest(ownerPosItemReturnReportsSchema, input);
    if (query.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: query.branchId, merchantId },
        select: { id: true },
      });
      if (!branch) throw new NotFoundException('Branch not found.');
    }

    const where: Prisma.PosOrderItemReturnWhereInput = {
      merchantId,
      issuedAt: { gte: new Date(query.from), lt: new Date(query.to) },
      order: {
        is: {
          source: 'pos',
          branchId: query.branchId ?? { not: null },
        },
      },
    };
    if (query.cursor) {
      const anchor = await this.prisma.posOrderItemReturn.findFirst({
        where: { ...where, id: query.cursor },
        select: { id: true },
      });
      assertScopedCursor(query.cursor, anchor !== null);
    }

    const records = await this.prisma.posOrderItemReturn.findMany({
      where,
      select: {
        id: true,
        returnNumber: true,
        orderId: true,
        reason: true,
        amount: true,
        currency: true,
        issuedAt: true,
        snapshot: true,
        order: {
          select: {
            id: true,
            orderReference: true,
            branchId: true,
            branchName: true,
            fulfillmentType: true,
            branch: { select: { name: true } },
          },
        },
        lines: {
          orderBy: [{ orderLineId: 'asc' }, { id: 'asc' }],
          select: {
            productName: true,
            variantName: true,
            quantity: true,
            disposition: true,
            amount: true,
          },
        },
      },
      orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = records.length > query.limit;
    const items = records.slice(0, query.limit).map((record) => {
      const snapshot = isJsonObject(record.snapshot) ? record.snapshot : {};
      const branchId = record.order.branchId;
      if (!branchId) throw new Error('POS item return report is missing its branch snapshot.');
      const fulfillmentType = ['dine_in', 'takeaway', 'delivery'].includes(
        record.order.fulfillmentType,
      )
        ? (record.order.fulfillmentType as OwnerPosItemReturnReportRow['fulfillmentType'])
        : 'unknown';
      return {
        id: record.id,
        returnNumber: record.returnNumber,
        orderId: record.orderId,
        orderReference:
          record.order.orderReference ?? `ORD-${record.orderId.slice(0, 8).toUpperCase()}`,
        branchId,
        branchName: record.order.branchName ?? record.order.branch?.name ?? '',
        fulfillmentType,
        issuedAt: record.issuedAt.toISOString(),
        reason: record.reason,
        referenceValue: record.amount.toFixed(2),
        currency: (record.currency || 'EGP') as 'EGP',
        issuedBy: stringFromJson(snapshot, 'issuedBy') ?? '—',
        approvedBy: nullableStringFromJson(snapshot, 'approvedBy'),
        lines: record.lines.map((line) => ({
          productName: line.productName,
          variantName: line.variantName,
          quantity: line.quantity,
          disposition: 'waste' as const,
          referenceValue: line.amount.toFixed(2),
        })),
      };
    });
    return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
  }

  async state(employee: PosEmployeeSession, orderId: string): Promise<PosOrderReturnsState> {
    this.requireSell(employee);
    return this.readState(this.prisma, employee, orderId);
  }

  async record(
    employee: PosEmployeeSession,
    orderId: string,
    input: Omit<RecordPosItemReturnRequest, 'approval'>,
    approverEmployeeId?: string,
  ): Promise<RecordPosItemReturnResponse> {
    this.requireSell(employee);
    const actor = `pos:${employee.id}`;
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ orderId, ...input, approverEmployeeId: approverEmployeeId ?? null }))
      .digest('hex');

    return this.prisma.$transaction(async (tx) => {
      const activeBranchIds = employee.branches
        .filter((branch) => branch.archivedAt === null)
        .map((branch) => branch.id);
      if (!activeBranchIds.includes(input.branchId))
        throw new ForbiddenException('This employee is not assigned to the selected branch.');

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
          state: await this.readState(tx, employee, orderId),
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
          state: await this.readState(tx, employee, orderId),
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
        state: await this.readState(tx, employee, orderId),
      };
    });
  }

  private async readState(
    client: Prisma.TransactionClient | PrismaService,
    employee: PosEmployeeSession,
    orderId: string,
  ): Promise<PosOrderReturnsState> {
    const order = await client.storefrontOrder.findFirst({
      where: {
        id: orderId,
        merchantId: employee.merchantId,
        source: 'pos',
        branchId: {
          in: employee.branches
            .filter((branch) => branch.archivedAt === null)
            .map((branch) => branch.id),
        },
      },
      select: {
        id: true,
        orderReference: true,
        status: true,
        completedAt: true,
        lines: {
          orderBy: [{ position: 'asc' }, { id: 'asc' }],
          include: {
            selections: { orderBy: [{ groupPosition: 'asc' }, { optionPosition: 'asc' }] },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('The POS order was not found.');
    const returned = await client.posOrderItemReturnLine.groupBy({
      by: ['orderLineId'],
      where: { merchantId: employee.merchantId, orderId },
      _sum: { quantity: true },
    });
    const returnedByLine = new Map(
      returned.map((row) => [row.orderLineId, row._sum.quantity ?? 0]),
    );
    const returns = await client.posOrderItemReturn.findMany({
      where: { merchantId: employee.merchantId, orderId },
      orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
      take: 20,
      include: itemReturnInclude,
    });
    return {
      orderId,
      orderReference: order.orderReference ?? `ORD-${orderId.slice(0, 8).toUpperCase()}`,
      orderStatus: order.status,
      eligible: order.status === 'completed' && order.completedAt !== null,
      items: order.lines.map((line) => {
        const returnedQuantity = returnedByLine.get(line.id) ?? 0;
        return {
          orderLineId: line.id,
          productName: line.productName,
          variantName: line.variantName,
          selections: line.selections.map(
            (selection) =>
              `${selection.groupName}: ${selection.optionName}${selection.quantity > 1 ? ` ×${selection.quantity}` : ''}`,
          ),
          soldQuantity: line.quantity,
          returnedQuantity,
          returnableQuantity: Math.max(0, line.quantity - returnedQuantity),
          unitPrice: formatCents(toCents(line.unitPrice.toString())),
        };
      }),
      returns: returns.map((record) => this.toSummary(record)),
    };
  }

  private toSummary(record: ItemReturnRecord): PosItemReturnSummary {
    return {
      id: record.id,
      requestId: record.requestId,
      returnNumber: record.returnNumber,
      orderId: record.orderId,
      amount: formatCents(toCents(record.amount.toString())),
      currency: (record.currency || 'EGP') as 'EGP',
      reason: record.reason,
      issuedAt: record.issuedAt.toISOString(),
      createdByEmployeeId: record.createdByEmployeeId,
      approvedByEmployeeId: record.approvedByEmployeeId,
      issuedBy: record.createdBy.displayName,
      approvedBy: record.approvedBy?.displayName ?? null,
      lines: record.lines.map((line) => ({
        orderLineId: line.orderLineId,
        productName: line.productName,
        variantName: line.variantName,
        quantity: line.quantity,
        disposition: 'waste',
        unitPrice: formatCents(toCents(line.unitPrice.toString())),
        amount: formatCents(toCents(line.amount.toString())),
      })),
    };
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
    return this.toSummary(record);
  }

  private requireSell(employee: PosEmployeeSession): void {
    const current = employee.permissions.includes('sell');
    if (!current) throw new ForbiddenException('This employee cannot record POS item returns.');
  }
}

function isJsonObject(value: Prisma.JsonValue): value is Prisma.JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringFromJson(value: Prisma.JsonObject, key: string): string | null {
  const candidate = value[key];
  return typeof candidate === 'string' ? candidate : null;
}

function nullableStringFromJson(value: Prisma.JsonObject, key: string): string | null {
  const candidate = value[key];
  return typeof candidate === 'string' ? candidate : null;
}
