import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreatePosDiningTableRequest,
  CursorPage,
  MovePosDiningSessionRequest,
  PosDiningSessionSummary,
  PosDiningTableOption,
  PosDiningTableSummary,
  PosEmployeeSession,
  SplitPosOrderChecksRequest,
  SplitPosOrderChecksResponse,
  UpdatePosDiningTableRequest,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { createHash } from 'node:crypto';
import { toCents, formatCents, requireEgpCurrency } from '../../common/money/money.js';
import { assertScopedCursor } from '../../common/http/pagination.js';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import {
  isSerializationConflict,
  isUniqueConstraintError,
} from '../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import {
  createPosDiningTableSchema,
  ownerPosDiningTableListSchema,
  parseMovePosDiningSession,
  splitPosOrderChecksSchema,
  updatePosDiningTableSchema,
  type OwnerPosDiningTableListQuery,
} from './pos-dining.schemas.js';

const tableInclude = {
  branch: { select: { id: true, name: true } },
} satisfies Prisma.PosDiningTableInclude;

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

  async listOwnerTables(
    merchantId: string,
    input: OwnerPosDiningTableListQuery,
  ): Promise<CursorPage<PosDiningTableSummary>> {
    const query = parseRequest(ownerPosDiningTableListSchema, input);
    const where: Prisma.PosDiningTableWhereInput = {
      merchantId,
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.status === 'active'
        ? { active: true }
        : query.status === 'inactive'
          ? { active: false }
          : {}),
    };
    if (query.cursor) {
      const anchor = await this.prisma.posDiningTable.findFirst({
        where: { ...where, id: query.cursor },
        select: { id: true },
      });
      assertScopedCursor(query.cursor, anchor !== null);
    }
    const records = await this.prisma.posDiningTable.findMany({
      where,
      include: tableInclude,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = records.length > query.limit;
    const items = records.slice(0, query.limit).map(toTableSummary);
    return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
  }

  async createTable(
    merchantId: string,
    actor: string,
    input: CreatePosDiningTableRequest,
  ): Promise<PosDiningTableSummary> {
    const request = parseRequest(createPosDiningTableSchema, input);
    try {
      const record = await this.prisma.$transaction(async (tx) => {
        const branch = await tx.branch.findFirst({
          where: { id: request.branchId, merchantId, archivedAt: null },
          select: { id: true },
        });
        if (!branch) throw new ConflictException('Select an active branch for this table.');
        return tx.posDiningTable.create({
          data: {
            merchantId,
            branchId: branch.id,
            code: request.code,
            capacity: request.capacity,
            createdBy: actor,
            updatedBy: actor,
          },
          include: tableInclude,
        });
      });
      return toTableSummary(record);
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw new ConflictException('A table with this code already exists at the branch.');
      throw error;
    }
  }

  async updateTable(
    merchantId: string,
    actor: string,
    tableId: string,
    input: UpdatePosDiningTableRequest,
  ): Promise<PosDiningTableSummary> {
    const request = parseRequest(updatePosDiningTableSchema, input);
    try {
      const record = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "pos_dining_tables" WHERE "id" = ${tableId}::uuid AND "merchantId" = ${merchantId}::uuid FOR UPDATE`;
        const current = await tx.posDiningTable.findFirst({
          where: { id: tableId, merchantId },
          select: { id: true, branchId: true, revision: true },
        });
        if (!current) throw new NotFoundException('The table was not found.');
        if (current.revision !== request.revision)
          throw new ConflictException('This table changed. Reload it before saving.');
        const session = await tx.posDiningSession.findFirst({
          where: { merchantId, tableId, status: 'open' },
          select: { id: true },
        });
        if (session)
          throw new ConflictException('An occupied table cannot be edited or deactivated.');
        const updated = await tx.posDiningTable.updateMany({
          where: { id: tableId, merchantId, revision: request.revision },
          data: {
            code: request.code,
            capacity: request.capacity,
            active: request.active,
            revision: { increment: 1 },
            updatedBy: actor,
          },
        });
        if (updated.count !== 1)
          throw new ConflictException('This table changed. Reload it before saving.');
        return tx.posDiningTable.findFirstOrThrow({
          where: { id: tableId, merchantId },
          include: tableInclude,
        });
      });
      return toTableSummary(record);
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw new ConflictException('A table with this code already exists at the branch.');
      throw error;
    }
  }

  async listTablesForEmployee(
    employee: PosEmployeeSession,
    branchId: string,
  ): Promise<PosDiningTableOption[]> {
    this.requireSell(employee);
    this.requireBranch(employee, branchId);
    const tables = await this.prisma.posDiningTable.findMany({
      where: { merchantId: employee.merchantId, branchId, active: true },
      include: {
        branch: { select: { name: true } },
        sessions: {
          where: { status: 'open' },
          take: 1,
          include: { _count: { select: { orders: true } }, orders: { select: { total: true } } },
        },
      },
      orderBy: [{ code: 'asc' }, { id: 'asc' }],
      take: 100,
    });
    return tables.map((table) => {
      const session = table.sessions[0];
      const outstandingCents =
        session?.orders.reduce((sum, order) => sum + toCents(order.total.toString()), 0n) ?? 0n;
      return {
        id: table.id,
        branchId: table.branchId,
        branchName: table.branch.name,
        code: table.code,
        capacity: table.capacity,
        active: table.active,
        revision: table.revision,
        occupancy: session ? 'occupied' : 'available',
        sessionId: session?.id ?? null,
        sessionRevision: session?.revision ?? null,
        openedAt: session?.openedAt.toISOString() ?? null,
        orderCount: session?._count.orders ?? 0,
        outstandingTotal: formatCents(outstandingCents),
      };
    });
  }

  async listOpenSessionsForEmployee(
    employee: PosEmployeeSession,
    branchId: string,
  ): Promise<PosDiningSessionSummary[]> {
    this.requireSell(employee);
    this.requireBranch(employee, branchId);
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
    this.requireBranch(employee, branchId);
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
    this.requireSell(employee);
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
          this.requireBranch(employee, observed.branchId);
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
    this.requireSell(employee);
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

  private requireSell(employee: PosEmployeeSession): void {
    if (!employee.permissions.includes('sell'))
      throw new ForbiddenException('This employee is not authorized to use POS dining.');
  }

  private requireBranch(employee: PosEmployeeSession, branchId: string): void {
    if (!employee.branches.some((branch) => branch.id === branchId && branch.archivedAt === null))
      throw new ForbiddenException('This employee is not assigned to the selected branch.');
  }
}

export function buildCheckValues(
  lines: Array<{ id: string; quantity: number; unitPrice: { toString(): string } }>,
  orderTotal: string,
  request: SplitPosOrderChecksRequest,
): Array<{
  amountCents: bigint;
  allocations: Array<{ orderLineId: string; quantity: number; amountCents: bigint }>;
}> {
  const totalCents = toCents(orderTotal);
  if (request.method === 'equal') {
    if (BigInt(request.checkCount) > totalCents)
      throw new BadRequestException('The total is too small for that many separate checks.');
    const each = totalCents / BigInt(request.checkCount);
    let remainder = totalCents % BigInt(request.checkCount);
    return Array.from({ length: request.checkCount }, () => {
      const amountCents = each + (remainder > 0n ? 1n : 0n);
      if (remainder > 0n) remainder -= 1n;
      return { amountCents, allocations: [] };
    });
  }
  if (request.method === 'custom') {
    const amounts = request.amounts.map((value) => toCents(value));
    if (amounts.some((value) => value <= 0n))
      throw new BadRequestException('Every check amount must be greater than zero.');
    if (amounts.reduce((sum, value) => sum + value, 0n) !== totalCents)
      throw new BadRequestException('Custom check amounts must equal the complete order total.');
    return amounts.map((amountCents) => ({ amountCents, allocations: [] }));
  }

  const linesById = new Map(lines.map((line) => [line.id, line]));
  const allocated = new Map<string, number>();
  const checks = request.checks.map((check) => {
    const allocations = check.lines.map(({ orderLineId, quantity }) => {
      const line = linesById.get(orderLineId);
      if (!line) throw new BadRequestException('A split references a line outside this order.');
      allocated.set(orderLineId, (allocated.get(orderLineId) ?? 0) + quantity);
      if (allocated.get(orderLineId)! > line.quantity)
        throw new BadRequestException('A check split cannot allocate more items than were sold.');
      return {
        orderLineId,
        quantity,
        amountCents: toCents(line.unitPrice.toString()) * BigInt(quantity),
      };
    });
    return {
      amountCents: allocations.reduce((sum, value) => sum + value.amountCents, 0n),
      allocations,
    };
  });
  if (lines.some((line) => allocated.get(line.id) !== line.quantity))
    throw new BadRequestException('Assign every whole item quantity to exactly one check.');
  if (checks.some((check) => check.amountCents <= 0n))
    throw new BadRequestException('Every item check must include at least one item.');
  if (checks.reduce((sum, check) => sum + check.amountCents, 0n) !== totalCents)
    throw new ConflictException('The order lines do not conserve the saved order total.');
  return checks;
}

function toTableSummary(table: {
  id: string;
  branchId: string;
  code: string;
  capacity: number;
  active: boolean;
  revision: number;
  branch: { id?: string; name: string };
}): PosDiningTableSummary {
  return {
    id: table.id,
    branchId: table.branchId,
    branchName: table.branch.name,
    code: table.code,
    capacity: table.capacity,
    active: table.active,
    revision: table.revision,
  };
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

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function replayAction<T>(
  previous: { action: string; fingerprint: string; createdBy: string; result: unknown },
  actor: string,
  fingerprint: string,
  action: string,
): T {
  if (
    previous.action !== action ||
    previous.createdBy !== actor ||
    previous.fingerprint !== fingerprint
  )
    throw new ConflictException('The request ID was already used for a different POS action.');
  return previous.result as T;
}
