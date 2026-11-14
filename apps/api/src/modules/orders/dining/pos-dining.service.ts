/**
 * Keeps orders attached to the right dining session and moves sessions between tables.
 * Table setup and bill splitting are handled by their own files.
 */
import {
  listOwnerTables,
  createTable,
  updateTable,
  listTablesForEmployee,
} from './dining-tables.js';
import { assertDiningSellAccess, assertDiningBranchAccess } from './dining-access.rules.js';
import { splitOrderChecks } from '../billing/split-order-checks.js';
import { hash, replayAction } from '../fulfillment/order-action.rules.js';
export { buildCheckValues } from '../billing/split-order-checks.js';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreatePosDiningTableRequest,
  MovePosDiningSessionRequest,
  PosDiningSessionSummary,
  PosEmployeeSession,
  SplitPosOrderChecksRequest,
  SplitPosOrderChecksResponse,
  UpdatePosDiningTableRequest,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';

import { toCents, formatCents, requireEgpCurrency } from '../../../common/money/money.js';

import {
  isSerializationConflict,
  isUniqueConstraintError,
} from '../../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import {
  parseMovePosDiningSession,
  type OwnerPosDiningTableListQuery,
} from './pos-dining.schemas.js';

const sessionInclude = {
  table: { select: { code: true } },
  orders: {
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
    select: {
      id: true,
      orderReference: true,
      total: true,
      currency: true,
      status: true,
      revision: true,
      createdAt: true,
      lines: {
        select: { id: true, productName: true, variantName: true, quantity: true, unitPrice: true },
      },
      checks: {
        orderBy: { position: 'asc' as const },
        include: {
          allocations: {
            include: {
              orderLine: { select: { id: true, productName: true, variantName: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.PosDiningSessionInclude;

type SessionRecord = Prisma.PosDiningSessionGetPayload<{ include: typeof sessionInclude }>;

@Injectable()
export class PosDiningService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  listOwnerTables(merchantId: string, input: OwnerPosDiningTableListQuery) {
    return listOwnerTables(this.prisma, merchantId, input);
  }
  createTable(merchantId: string, actor: string, input: CreatePosDiningTableRequest) {
    return createTable(this.prisma, merchantId, actor, input);
  }
  updateTable(
    merchantId: string,
    actor: string,
    tableId: string,
    input: UpdatePosDiningTableRequest,
  ) {
    return updateTable(this.prisma, merchantId, actor, tableId, input);
  }
  listTablesForEmployee(employee: PosEmployeeSession, branchId: string) {
    return listTablesForEmployee(this.prisma, employee, branchId);
  }

  async listOpenSessionsForEmployee(
    employee: PosEmployeeSession,
    branchId: string,
  ): Promise<PosDiningSessionSummary[]> {
    assertDiningSellAccess(employee);
    assertDiningBranchAccess(employee, branchId);
    const sessions = await this.prisma.posDiningSession.findMany({
      where: { merchantId: employee.merchantId, branchId, status: 'open' },
      include: sessionInclude,
      orderBy: [{ openedAt: 'asc' }, { id: 'asc' }],
      take: 100,
    });
    return sessions.map(toSessionSummary);
  }

  async attachOrder(
    tx: Prisma.TransactionClient,
    employee: PosEmployeeSession,
    branchId: string,
    tableId: string | null,
    orderId: string,
    orderTotal: string,
  ): Promise<void> {
    assertDiningBranchAccess(employee, branchId);
    if (tableId) {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "pos_dining_tables"
        WHERE "id" = ${tableId}::uuid AND "merchantId" = ${employee.merchantId}::uuid
          AND "branchId" = ${branchId}::uuid AND "active" = true
        FOR UPDATE
      `;
      if (!locked.length)
        throw new ConflictException('Choose an active table at the selected branch.');
      let session = await tx.posDiningSession.findFirst({
        where: { merchantId: employee.merchantId, branchId, tableId, status: 'open' },
        select: { id: true },
      });
      if (!session) {
        session = await tx.posDiningSession.create({
          data: {
            merchantId: employee.merchantId,
            branchId,
            tableId,
            openedByEmployeeId: employee.id,
          },
          select: { id: true },
        });
      }
      await tx.storefrontOrder.update({
        where: { id: orderId },
        data: { posDiningSessionId: session.id },
      });
    }
    await tx.posOrderCheck.create({
      data: {
        orderId,
        merchantId: employee.merchantId,
        position: 0,
        amount: orderTotal,
        splitMethod: 'whole',
      },
    });
  }

  async moveSession(
    employee: PosEmployeeSession,
    sessionId: string,
    input: MovePosDiningSessionRequest,
  ): Promise<PosDiningSessionSummary> {
    assertDiningSellAccess(employee);
    const request = parseMovePosDiningSession(input);
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
            return replayAction<PosDiningSessionSummary>(
              previous,
              actor,
              fingerprint,
              'dining_move',
            );
          const observed = await tx.posDiningSession.findFirst({
            where: {
              id: sessionId,
              merchantId: employee.merchantId,
              branchId: { in: employee.branches.map((b) => b.id) },
              status: 'open',
            },
            select: { tableId: true, branchId: true },
          });
          if (!observed) throw new NotFoundException('The open dining session was not found.');
          assertDiningBranchAccess(employee, observed.branchId);
          const tableIds = [...new Set([observed.tableId, request.tableId])].sort();
          for (const tableId of tableIds) {
            await tx.$queryRaw`SELECT "id" FROM "pos_dining_tables" WHERE "id" = ${tableId}::uuid AND "merchantId" = ${employee.merchantId}::uuid AND "branchId" = ${observed.branchId}::uuid FOR UPDATE`;
          }
          await tx.$queryRaw`SELECT "id" FROM "pos_dining_sessions" WHERE "id" = ${sessionId}::uuid AND "merchantId" = ${employee.merchantId}::uuid FOR UPDATE`;
          const session = await tx.posDiningSession.findFirst({
            where: {
              id: sessionId,
              merchantId: employee.merchantId,
              branchId: observed.branchId,
              status: 'open',
            },
            include: {
              orders: {
                orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
                take: 1,
                select: { id: true },
              },
            },
          });
          if (!session || session.tableId !== observed.tableId)
            throw new ConflictException('This table session changed. Reload it before moving.');
          if (session.revision !== request.revision)
            throw new ConflictException('This table session changed. Reload it before moving.');
          if (!session.orders[0])
            throw new ConflictException('An empty table session cannot be moved.');
          const destination = await tx.posDiningTable.findFirst({
            where: {
              id: request.tableId,
              merchantId: employee.merchantId,
              branchId: session.branchId,
              active: true,
            },
            select: { id: true },
          });
          if (!destination)
            throw new ConflictException('Choose an available active table in the same branch.');
          if (request.tableId === session.tableId)
            throw new BadRequestException('Choose a different table to move this session.');
          const occupied = await tx.posDiningSession.findFirst({
            where: {
              merchantId: employee.merchantId,
              tableId: request.tableId,
              status: 'open',
              id: { not: session.id },
            },
            select: { id: true },
          });
          if (occupied) throw new ConflictException('That table is already occupied.');
          await tx.posDiningSession.update({
            where: { id: session.id },
            data: { tableId: request.tableId, revision: { increment: 1 } },
          });
          const result = toSessionSummary(
            await tx.posDiningSession.findFirstOrThrow({
              where: { id: session.id, merchantId: employee.merchantId },
              include: sessionInclude,
            }),
          );
          await tx.storefrontOrderAction.create({
            data: {
              merchantId: employee.merchantId,
              orderId: session.orders[0].id,
              requestId: request.requestId,
              action: 'dining_move',
              fingerprint,
              result: result as unknown as Prisma.InputJsonValue,
              createdBy: actor,
            },
          });
          return result;
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
          return replayAction<PosDiningSessionSummary>(previous, actor, fingerprint, 'dining_move');
        if (isUniqueConstraintError(error))
          throw new ConflictException('That table is already occupied.');
        throw new ConflictException('The table session changed. Reload and retry.');
      }
      throw error;
    }
  }

  async splitOrder(
    employee: PosEmployeeSession,
    orderId: string,
    input: SplitPosOrderChecksRequest,
  ): Promise<SplitPosOrderChecksResponse> {
    return splitOrderChecks(this.prisma, employee, orderId, input);
  }
}

function toSessionSummary(session: SessionRecord): PosDiningSessionSummary {
  const orders = session.orders.map((order) => ({
    id: order.id,
    orderReference: order.orderReference,
    total: formatCents(toCents(order.total.toString())),
    currency: requireEgpCurrency(order.currency),
    status: order.status,
    revision: order.revision,
    createdAt: order.createdAt.toISOString(),
    lines: order.lines.map((line) => ({
      id: line.id,
      productName: line.productName,
      variantName: line.variantName,
      quantity: line.quantity,
      unitPrice: formatCents(toCents(line.unitPrice.toString())),
    })),
    checks: order.checks.map((check) => ({
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
  }));
  const outstandingCents = orders.reduce((sum, order) => sum + toCents(order.total), 0n);
  return {
    id: session.id,
    branchId: session.branchId,
    tableId: session.tableId,
    tableCode: session.table.code,
    revision: session.revision,
    openedAt: session.openedAt.toISOString(),
    orderCount: orders.length,
    outstandingTotal: formatCents(outstandingCents),
    orders,
  };
}
