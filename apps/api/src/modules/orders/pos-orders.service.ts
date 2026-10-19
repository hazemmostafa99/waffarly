import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  InternalServerErrorException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreatePosOrderResponse,
  PosEmployeeSession,
  PosOrderPaymentStateResponse,
  PosPaymentSummary,
  PosReceipt,
  PosReceiptHistoryPage,
  RecordPosCheckPaymentResponse,
  PosOrderQuoteRequest,
  PosOrderQuoteResponse,
  StorefrontOrderSummary,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { createHash, randomUUID } from 'node:crypto';
import { formatCents, toCents } from '../../common/money/money.js';
import { assertScopedCursor, type CursorPageQuery } from '../../common/http/pagination.js';
import {
  isSerializationConflict,
  isUniqueConstraintError,
} from '../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import {
  ProductConsumptionService,
  ProductPricingService,
  type InventoryRequirement,
} from '../catalog/index.js';
import { InventoryLedgerService } from '../inventory/index.js';
import { ShiftsService } from '../shifts/index.js';
import { requireEmployeePermission } from '../auth/index.js';
import { parseRecordPosCheckPaymentRequest, PaymentsService } from '../payments/index.js';
import { PosDiningService } from './pos-dining.service.js';
import { buildPosReceiptSnapshot } from './pos-receipt.mapper.js';
import { toSummary } from './order.mapper.js';
import {
  consumeDirectOrderRequirements,
  freezeLineStockRequirements,
  resolveConsumptionWarehouse,
} from './order-stock.persistence.js';
import { parseCreatePosOrderRequest, parsePosOrderQuoteRequest } from './pos-orders.schemas.js';

const MAX_ORDER_TOTAL_CENTS = 999_999_999_999n;
const orderSummaryInclude = {
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

const posReceiptOrderInclude = {
  merchant: { select: { name: true } },
  branch: { select: { name: true } },
  posShift: { include: { register: { select: { name: true } } } },
  diningSession: { include: { table: { select: { code: true } } } },
  lines: {
    orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
    include: {
      selections: {
        orderBy: [{ groupPosition: 'asc' as const }, { optionPosition: 'asc' as const }],
      },
      variantAttributes: { orderBy: { position: 'asc' as const } },
    },
  },
} satisfies Prisma.StorefrontOrderInclude;

@Injectable()
export class PosOrdersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProductPricingService) private readonly pricing: ProductPricingService,
    @Inject(ProductConsumptionService) private readonly consumption: ProductConsumptionService,
    @Inject(InventoryLedgerService) private readonly ledger: InventoryLedgerService,
    @Inject(ShiftsService) private readonly shifts: ShiftsService,
    @Inject(PosDiningService) private readonly dining: PosDiningService,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
  ) {}

  async quote(employee: PosEmployeeSession, input: unknown): Promise<PosOrderQuoteResponse> {
    this.requireSellPermission(employee);
    const request = parsePosOrderQuoteRequest(input);
    return this.quoteItems(employee.merchantId, request);
  }

  async create(employee: PosEmployeeSession, input: unknown): Promise<CreatePosOrderResponse> {
    this.requireSellPermission(employee);
    const request = parseCreatePosOrderRequest(input);
    const actor = `pos:${employee.id}`;
    const fingerprint = createHash('sha256').update(JSON.stringify(request)).digest('hex');
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
          if (previous) return this.replay(previous, actor, fingerprint);

          const shift = await this.shifts.lockOpenShiftForSale(tx, employee, request.registerId);
          const quote = await this.quoteItems(employee.merchantId, request, tx);
          const orderTotalCents = toCents(quote.total);
          const order = await tx.storefrontOrder.create({
            data: {
              merchantId: employee.merchantId,
              customerName: request.customerName?.trim() || null,
              customerPhone: request.customerPhone?.trim() || null,
              deliveryAddress:
                request.fulfillmentType === 'delivery' ? request.deliveryAddress!.trim() : null,
              fulfillmentType: request.fulfillmentType,
              source: 'pos',
              posShiftId: shift.id,
              createdByPosEmployeeId: employee.id,
              branchId: shift.branchId,
              total: formatCents(orderTotalCents),
              currency: 'EGP',
            },
            select: { id: true },
          });
          const quoteByLineId = new Map(quote.items.map((item) => [item.lineId, item.quote]));
          const directRequirementsByLine = new Map<string, InventoryRequirement[]>();
          let hasDirectStock = false;

          for (const [position, item] of request.items.entries()) {
            const product = await tx.product.findFirst({
              where: { id: item.productId, merchantId: employee.merchantId, archivedAt: null },
              select: {
                id: true,
                name: true,
                availability: true,
                revision: true,
                inventoryConfiguration: { select: { mode: true } },
                variants: {
                  select: {
                    id: true,
                    name: true,
                    availability: true,
                    stockQuantity: true,
                    attributeSelections: {
                      orderBy: { attribute: { position: 'asc' } },
                      select: {
                        attributeId: true,
                        valueId: true,
                        attribute: { select: { id: true, name: true, position: true } },
                        value: { select: { id: true, value: true } },
                      },
                    },
                  },
                },
                modifierGroups: {
                  orderBy: { position: 'asc' },
                  select: {
                    id: true,
                    modifierGroupId: true,
                    position: true,
                    modifierGroup: { select: { name: true } },
                    options: {
                      orderBy: { option: { position: 'asc' } },
                      select: {
                        optionId: true,
                        priceAdjustment: true,
                        option: { select: { name: true, position: true } },
                      },
                    },
                  },
                },
              },
            });
            const lineQuote = quoteByLineId.get(item.lineId);
            if (!product || product.availability !== 'available' || !lineQuote)
              throw new ConflictException('A product in this order is no longer available.');
            if (
              product.revision !== item.expectedProductRevision ||
              product.revision !== lineQuote.productRevision
            )
              throw new ConflictException(
                'A product changed. Review the updated quote before confirming.',
              );

            const variant = lineQuote.variantId
              ? product.variants.find((candidate) => candidate.id === lineQuote.variantId)
              : undefined;
            if (product.variants.length > 0 && (!variant || variant.availability !== 'available'))
              throw new ConflictException('A selected variant is no longer available.');

            const mode = product.inventoryConfiguration?.mode ?? null;
            if (mode && mode !== 'DIRECT' && mode !== 'RECIPE')
              throw new ConflictException('The product stock handling is not supported.');
            let stockHandling: string = 'legacy';
            let requirements: InventoryRequirement[] = [];
            if (mode === 'DIRECT' || mode === 'RECIPE') {
              stockHandling = mode === 'DIRECT' ? 'direct_sale' : 'recipe_acceptance';
              requirements = await this.consumption.requirements(
                tx,
                employee.merchantId,
                [
                  {
                    productId: product.id,
                    variantId: variant?.id ?? null,
                    quantity: item.quantity,
                    selections: quoteSelectionsForRequirements(lineQuote.selections),
                  },
                ],
                mode,
              );
              if (mode === 'DIRECT') {
                hasDirectStock = true;
                directRequirementsByLine.set(item.lineId, requirements);
              }
            }

            let stockReserved = false;
            if (
              stockHandling === 'legacy' &&
              variant?.stockQuantity !== null &&
              variant?.stockQuantity !== undefined
            ) {
              const reservation = await tx.productVariant.updateMany({
                where: {
                  id: variant.id,
                  merchantId: employee.merchantId,
                  productId: product.id,
                  availability: 'available',
                  stockQuantity: { gte: item.quantity },
                },
                data: { stockQuantity: { decrement: item.quantity } },
              });
              if (reservation.count !== 1)
                throw new ConflictException('A selected variant does not have enough stock.');
              stockReserved = true;
            }

            const selectionSnapshots = createSelectionSnapshots(product, lineQuote.selections);
            const lineTotalCents = toCents(lineQuote.totalPrice) * BigInt(item.quantity);
            const savedLine = await tx.storefrontOrderLine.create({
              data: {
                orderId: order.id,
                merchantId: employee.merchantId,
                productId: product.id,
                variantId: variant?.id ?? null,
                productName: product.name,
                variantName: variant?.name ?? null,
                basePrice: lineQuote.basePrice,
                modifierTotal: lineQuote.modifierTotal,
                quantity: item.quantity,
                unitPrice: lineQuote.totalPrice,
                lineTotal: formatCents(lineTotalCents),
                note: item.note?.trim() || null,
                stockHandling,
                stockReserved,
                position,
                selections: { create: selectionSnapshots },
                variantAttributes: {
                  create: lineQuote.variantAttributes.map((attribute) => ({
                    attributeId: attribute.attributeId,
                    valueId: attribute.valueId,
                    attributeName: attribute.attributeName,
                    attributeValue: attribute.value,
                    position: attribute.position,
                  })),
                },
              },
              select: { id: true },
            });
            if (mode === 'DIRECT' || mode === 'RECIPE') {
              await freezeLineStockRequirements(
                tx,
                employee.merchantId,
                savedLine.id,
                requirements,
              );
            }
          }

          if (orderTotalCents > MAX_ORDER_TOTAL_CENTS)
            throw new BadRequestException('The order total is too large.');
          await this.dining.attachOrder(
            tx,
            employee,
            shift.branchId,
            request.fulfillmentType === 'dine_in' ? request.tableId! : null,
            order.id,
            formatCents(orderTotalCents),
          );
          if (hasDirectStock) {
            const warehouse = await resolveConsumptionWarehouse(
              tx,
              employee.merchantId,
              shift.branchId,
            );
            const requirements = [...directRequirementsByLine.values()].flat();
            await consumeDirectOrderRequirements(
              tx,
              this.ledger,
              employee.merchantId,
              actor,
              order.id,
              warehouse.id,
              requirements,
            );
            await tx.storefrontOrder.update({
              where: { id: order.id },
              data: {
                warehouseId: warehouse.id,
                branchName: warehouse.branch.name,
                warehouseName: warehouse.name,
              },
            });
          }

          const saved = await tx.storefrontOrder.findFirstOrThrow({
            where: { id: order.id, merchantId: employee.merchantId },
            include: orderSummaryInclude,
          });
          const summary = toSummary(saved);
          await tx.storefrontOrderAction.create({
            data: {
              merchantId: employee.merchantId,
              orderId: order.id,
              requestId: request.requestId,
              action: 'pos_sale',
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
        if (previous) return this.replay(previous, actor, fingerprint);
        if (isUniqueConstraintError(error))
          throw new ConflictException('This sale request conflicts with an existing command.');
      }
      if (isSerializationConflict(error))
        throw new ConflictException('The order or stock changed. Review the cart and retry.');
      throw error;
    }
  }

  async recordCheckPayment(
    employee: PosEmployeeSession,
    orderId: string,
    checkId: string,
    input: unknown,
  ): Promise<RecordPosCheckPaymentResponse> {
    this.requireSellPermission(employee);
    const request = parseRecordPosCheckPaymentRequest(input);
    const actor = `pos:${employee.id}`;
    const fingerprint = createHash('sha256').update(JSON.stringify(request)).digest('hex');
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
          if (previous) return replayPosPayment(previous, actor, fingerprint);

          const observedOrder = await tx.storefrontOrder.findFirst({
            where: {
              id: orderId,
              merchantId: employee.merchantId,
              source: 'pos',
              branchId: { in: employee.branches.map((branch) => branch.id) },
            },
            select: { branchId: true, posShiftId: true },
          });
          if (!observedOrder) throw new NotFoundException('The POS order was not found.');
          if (!observedOrder.posShiftId || !observedOrder.branchId)
            throw new ConflictException('This order is not linked to a POS shift.');
          await this.shifts.lockOpenShiftForPayment(tx, {
            merchantId: employee.merchantId,
            shiftId: observedOrder.posShiftId,
            branchId: observedOrder.branchId,
          });
          await tx.$queryRaw`SELECT "id" FROM "storefront_orders" WHERE "id" = ${orderId}::uuid AND "merchantId" = ${employee.merchantId}::uuid FOR UPDATE`;
          const order = await tx.storefrontOrder.findFirst({
            where: {
              id: orderId,
              merchantId: employee.merchantId,
              source: 'pos',
              branchId: { in: employee.branches.map((branch) => branch.id) },
            },
            select: {
              id: true,
              branchId: true,
              currency: true,
              posShiftId: true,
              revision: true,
              status: true,
              cancelledAt: true,
            },
          });
          if (!order) throw new NotFoundException('The POS order was not found.');
          if (order.revision !== request.revision)
            throw new ConflictException('This order changed. Reload it before taking payment.');
          if (order.cancelledAt || order.status === 'cancelled')
            throw new ConflictException('A cancelled order cannot be paid.');
          if (!order.posShiftId || !order.branchId)
            throw new ConflictException('This order is not linked to a POS shift.');
          if (order.posShiftId !== observedOrder.posShiftId)
            throw new ConflictException('This order changed. Reload it before taking payment.');

          const lockedCheck = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT "id"
            FROM "pos_order_checks"
            WHERE "id" = ${checkId}::uuid
              AND "orderId" = ${orderId}::uuid
              AND "merchantId" = ${employee.merchantId}::uuid
            FOR UPDATE
          `;
          if (lockedCheck.length === 0) throw new NotFoundException('The check was not found.');
          const check = await tx.posOrderCheck.findFirst({
            where: { id: checkId, orderId, merchantId: employee.merchantId },
          });
          if (!check) throw new NotFoundException('The check was not found.');
          if (check.settledAt) throw new ConflictException('This check is already settled.');

          const existingPayments = await tx.posOrderPayment.aggregate({
            where: { orderId, checkId, merchantId: employee.merchantId },
            _sum: { amount: true },
          });
          const alreadyPaid = toCents(existingPayments._sum.amount?.toString() ?? '0.00');
          const checkAmount = toCents(check.amount.toString());
          const balanceCents = checkAmount - alreadyPaid;
          if (balanceCents <= 0n)
            throw new ConflictException('This check has no remaining balance.');

          const tenderResult = await this.payments.recordCheckTenders(tx, {
            merchantId: employee.merchantId,
            orderId,
            checkId,
            shiftId: order.posShiftId,
            requestId: request.requestId,
            currency: order.currency,
            balanceDue: formatCents(balanceCents),
            employee,
            tenders: request.tenders,
          });
          const paidAfter = checkAmount - toCents(tenderResult.balanceDue);
          const settledAt = paidAfter === checkAmount ? new Date() : null;
          const changed = await tx.storefrontOrder.updateMany({
            where: { id: orderId, merchantId: employee.merchantId, revision: request.revision },
            data: { revision: { increment: 1 } },
          });
          if (changed.count !== 1)
            throw new ConflictException('This order changed. Reload it before taking payment.');
          const updatedCheck = await tx.posOrderCheck.update({
            where: { id: checkId },
            data: { revision: { increment: 1 }, settledAt },
            select: { id: true, amount: true, revision: true, settledAt: true },
          });
          const receipt = settledAt
            ? await this.issueSettledCheckReceipt(tx, employee, orderId, checkId, settledAt)
            : null;
          const response: RecordPosCheckPaymentResponse = {
            orderId,
            orderRevision: request.revision + 1,
            check: {
              id: updatedCheck.id,
              amount: updatedCheck.amount.toFixed(2),
              paidAmount: formatCents(paidAfter),
              balanceDue: tenderResult.balanceDue,
              revision: updatedCheck.revision,
              status: settledAt ? 'settled' : 'open',
              settledAt: updatedCheck.settledAt?.toISOString() ?? null,
              receipt: receipt
                ? {
                    id: receipt.id,
                    receiptNumber: receipt.receiptNumber,
                    issuedAt: receipt.issuedAt,
                  }
                : null,
            },
            payments: tenderResult.payments,
            receipt,
          };
          await tx.storefrontOrderAction.create({
            data: {
              merchantId: employee.merchantId,
              orderId,
              requestId: request.requestId,
              action: 'pos_payment',
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
        if (previous) return replayPosPayment(previous, actor, fingerprint);
        if (isUniqueConstraintError(error))
          throw new ConflictException(
            'This payment conflicts with a recent update. Reload and retry.',
          );
        throw new ConflictException('This order changed. Reload it before taking payment.');
      }
      throw error;
    }
  }

  async detail(employee: PosEmployeeSession, orderId: string): Promise<StorefrontOrderSummary> {
    this.requireSellPermission(employee);
    const order = await this.prisma.storefrontOrder.findFirst({
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
      include: orderSummaryInclude,
    });
    if (!order) throw new NotFoundException('The POS order was not found.');
    return toSummary(order);
  }

  async paymentState(
    employee: PosEmployeeSession,
    orderId: string,
  ): Promise<PosOrderPaymentStateResponse> {
    this.requireSellPermission(employee);
    const order = await this.prisma.storefrontOrder.findFirst({
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
      include: {
        ...orderSummaryInclude,
        diningSession: { select: { table: { select: { code: true } } } },
        checks: {
          orderBy: { position: 'asc' },
          include: {
            allocations: {
              include: {
                orderLine: { select: { productName: true, variantName: true, position: true } },
              },
            },
            payments: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
            receipt: { select: { id: true, receiptNumber: true, issuedAt: true } },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('The POS order was not found.');
    return {
      context: { order: toSummary(order), tableCode: order.diningSession?.table.code ?? null },
      orderId: order.id,
      revision: order.revision,
      total: formatCents(toCents(order.total.toString())),
      currency: order.currency as 'EGP',
      status: order.status,
      checks: order.checks.map((check) => {
        const amountCents = toCents(check.amount.toString());
        const paidCents = check.payments.reduce(
          (total, payment) => total + toCents(payment.amount.toString()),
          0n,
        );
        return {
          splitMethod: check.splitMethod as 'whole' | 'items' | 'equal' | 'custom',
          allocations: [...check.allocations]
            .sort((a, b) => a.orderLine.position - b.orderLine.position)
            .map((line) => ({
              orderLineId: line.orderLineId,
              productName: line.orderLine.productName,
              variantName: line.orderLine.variantName,
              quantity: line.quantity,
              amount: formatCents(toCents(line.amount.toString())),
            })),
          id: check.id,
          position: check.position,
          amount: formatCents(amountCents),
          paidAmount: formatCents(paidCents),
          balanceDue: formatCents(amountCents - paidCents),
          revision: check.revision,
          status: check.settledAt ? ('settled' as const) : ('open' as const),
          settledAt: check.settledAt?.toISOString() ?? null,
          receipt: check.receipt
            ? {
                id: check.receipt.id,
                receiptNumber: check.receipt.receiptNumber,
                issuedAt: check.receipt.issuedAt.toISOString(),
              }
            : null,
          payments: check.payments.map((payment) => ({
            id: payment.id,
            position: payment.position,
            method: payment.method as PosPaymentSummary['method'],
            amount: formatCents(toCents(payment.amount.toString())),
            receivedAmount: formatCents(toCents(payment.receivedAmount.toString())),
            changeAmount: formatCents(toCents(payment.changeAmount.toString())),
            terminalReference: payment.terminalReference,
            operatorEmployeeId: payment.operatorEmployeeId,
            createdAt: payment.createdAt.toISOString(),
          })),
        };
      }),
    };
  }

  async getCheckReceipt(
    employee: PosEmployeeSession,
    orderId: string,
    checkId: string,
  ): Promise<PosReceipt> {
    requireEmployeePermission(employee, 'view_receipts');
    const order = await this.prisma.storefrontOrder.findFirst({
      where: {
        id: orderId,
        merchantId: employee.merchantId,
        source: 'pos',
        branchId: { in: employee.branches.map((branch) => branch.id) },
      },
      select: {
        checks: {
          where: { id: checkId, merchantId: employee.merchantId },
          select: { receipt: { select: { snapshot: true } } },
        },
      },
    });
    const snapshot = order?.checks[0]?.receipt?.snapshot;
    if (!snapshot) throw new NotFoundException('The POS receipt was not found.');
    return parseStoredPosReceipt(snapshot);
  }

  async listReceipts(
    employee: PosEmployeeSession,
    input: CursorPageQuery & { branchId: string },
  ): Promise<PosReceiptHistoryPage> {
    requireEmployeePermission(employee, 'view_receipts');
    if (!employee.branches.some((branch) => branch.id === input.branchId)) {
      throw new ForbiddenException('This employee is not assigned to the selected branch.');
    }
    const scopedReceiptWhere: Prisma.PosCheckReceiptWhereInput = {
      merchantId: employee.merchantId,
      order: { is: { source: 'pos', branchId: input.branchId } },
    };
    const anchor = input.cursor
      ? await this.prisma.posCheckReceipt.findFirst({
          where: { ...scopedReceiptWhere, id: input.cursor },
          select: { id: true },
        })
      : null;
    if (input.cursor) assertScopedCursor(input.cursor, anchor !== null);
    const receipts = await this.prisma.posCheckReceipt.findMany({
      where: scopedReceiptWhere,
      select: {
        id: true,
        receiptNumber: true,
        issuedAt: true,
        orderId: true,
        checkId: true,
        snapshot: true,
      },
      orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    const hasMore = receipts.length > input.limit;
    const items = receipts.slice(0, input.limit).map((row) => {
      const snapshot = parseStoredPosReceipt(row.snapshot);
      return {
        id: row.id,
        receiptNumber: row.receiptNumber,
        issuedAt: row.issuedAt.toISOString(),
        orderId: row.orderId,
        checkId: row.checkId,
        orderReference: snapshot.orderReference,
        checkNumber: snapshot.checkNumber,
        amount: snapshot.amount,
        currency: snapshot.currency,
      };
    });
    return {
      items,
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
    };
  }

  private async issueSettledCheckReceipt(
    tx: Prisma.TransactionClient,
    employee: PosEmployeeSession,
    orderId: string,
    checkId: string,
    issuedAt: Date,
  ): Promise<PosReceipt> {
    const check = await tx.posOrderCheck.findFirst({
      where: { id: checkId, orderId, merchantId: employee.merchantId },
      include: {
        order: { include: posReceiptOrderInclude },
        allocations: {
          include: {
            orderLine: {
              include: {
                selections: {
                  orderBy: [{ groupPosition: 'asc' }, { optionPosition: 'asc' }],
                },
                variantAttributes: { orderBy: { position: 'asc' } },
              },
            },
          },
        },
        payments: { orderBy: [{ createdAt: 'asc' }, { position: 'asc' }] },
      },
    });
    if (!check) throw new NotFoundException('The check was not found.');
    const receiptId = randomUUID();
    const receiptNumber = `POS-${receiptId.replaceAll('-', '').slice(0, 16).toUpperCase()}`;
    const toItem = (line: (typeof check.order.lines)[number], quantity: number, total: string) => ({
      name: line.productName,
      variantName:
        [
          line.variantName,
          ...line.variantAttributes.map(
            (attribute) => `${attribute.attributeName}: ${attribute.attributeValue}`,
          ),
        ]
          .filter((value): value is string => Boolean(value))
          .join(' · ') || null,
      selections: line.selections.map(
        (selection) =>
          `${selection.groupName}: ${selection.optionName}${selection.quantity > 1 ? ` ×${selection.quantity}` : ''}`,
      ),
      quantity,
      unitPrice: line.unitPrice.toString(),
      total,
    });
    const items =
      check.splitMethod === 'whole'
        ? check.order.lines.map((line) => toItem(line, line.quantity, line.lineTotal.toString()))
        : check.splitMethod === 'items'
          ? [...check.allocations]
              .sort((left, right) => left.orderLine.position - right.orderLine.position)
              .map((allocation) =>
                toItem(allocation.orderLine, allocation.quantity, allocation.amount.toString()),
              )
          : [];
    const splitMethod = ['whole', 'items', 'equal', 'custom'].includes(check.splitMethod)
      ? (check.splitMethod as PosReceipt['splitMethod'])
      : null;
    if (!splitMethod)
      throw new InternalServerErrorException('The POS check split method is invalid.');
    const receipt = buildPosReceiptSnapshot({
      id: receiptId,
      receiptNumber,
      issuedAt,
      merchantName: check.order.merchant.name,
      branchName: check.order.branch?.name ?? null,
      orderId: check.order.id,
      orderCreatedAt: check.order.createdAt,
      fulfillmentType: check.order.fulfillmentType as PosReceipt['fulfillmentType'],
      tableCode: check.order.diningSession?.table.code ?? null,
      cashierName: employee.displayName,
      registerName: check.order.posShift?.register.name ?? null,
      currency: check.order.currency,
      checkNumber: check.position + 1,
      splitMethod,
      amount: check.amount.toString(),
      items,
      payments: check.payments.map((payment) => ({
        method: payment.method as 'cash' | 'terminal',
        amount: payment.amount.toString(),
        receivedAmount: payment.receivedAmount.toString(),
        changeAmount: payment.changeAmount.toString(),
      })),
    });
    await tx.posCheckReceipt.create({
      data: {
        id: receipt.id,
        merchantId: employee.merchantId,
        orderId,
        checkId,
        createdByEmployeeId: employee.id,
        receiptNumber: receipt.receiptNumber,
        issuedAt,
        snapshot: receipt as unknown as Prisma.InputJsonValue,
      },
    });
    return receipt;
  }

  private async quoteItems(
    merchantId: string,
    request: PosOrderQuoteRequest,
    transaction?: Prisma.TransactionClient,
  ): Promise<PosOrderQuoteResponse> {
    const items: PosOrderQuoteResponse['items'] = [];
    let totalCents = 0n;
    for (const item of request.items) {
      const quote = await this.pricing.quoteForMerchant(
        merchantId,
        item.productId,
        item.selections,
        item.variantId,
        item.quantity,
        transaction,
      );
      const lineTotalCents = toCents(quote.totalPrice) * BigInt(item.quantity);
      totalCents += lineTotalCents;
      if (totalCents > MAX_ORDER_TOTAL_CENTS)
        throw new BadRequestException('The order total is too large.');
      items.push({
        lineId: item.lineId,
        quantity: item.quantity,
        lineTotal: formatCents(lineTotalCents),
        quote,
      });
    }
    const total = formatCents(totalCents);
    return { currency: 'EGP', subtotal: total, total, items };
  }

  private requireSellPermission(employee: PosEmployeeSession): void {
    if (!employee.permissions.includes('sell'))
      throw new ForbiddenException('This employee is not authorized to sell.');
  }

  private replay(
    previous: { action: string; fingerprint: string; createdBy: string; result: unknown },
    actor: string,
    fingerprint: string,
  ): CreatePosOrderResponse {
    if (
      previous.action !== 'pos_sale' ||
      previous.createdBy !== actor ||
      previous.fingerprint !== fingerprint
    )
      throw new ConflictException('The request ID was already used for a different sale.');
    return previous.result as CreatePosOrderResponse;
  }
}

function replayPosPayment(
  previous: { action: string; fingerprint: string; createdBy: string; result: unknown },
  actor: string,
  fingerprint: string,
): RecordPosCheckPaymentResponse {
  if (
    previous.action !== 'pos_payment' ||
    previous.createdBy !== actor ||
    previous.fingerprint !== fingerprint
  ) {
    throw new ConflictException('The request ID was already used for a different POS action.');
  }
  return previous.result as RecordPosCheckPaymentResponse;
}

function parseStoredPosReceipt(value: Prisma.JsonValue): PosReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InternalServerErrorException('The POS receipt snapshot is invalid.');
  }
  const receipt = value as unknown as PosReceipt;
  if (
    receipt.version !== 1 ||
    typeof receipt.id !== 'string' ||
    typeof receipt.receiptNumber !== 'string' ||
    typeof receipt.issuedAt !== 'string' ||
    typeof receipt.amount !== 'string' ||
    !Array.isArray(receipt.items) ||
    !Array.isArray(receipt.payments)
  ) {
    throw new InternalServerErrorException('The POS receipt snapshot is invalid.');
  }
  return receipt;
}

function quoteSelectionsForRequirements(
  selections: Array<{
    modifierGroupId: string;
    options?: Array<{ optionId: string; quantity: number }>;
    optionIds: string[];
  }>,
) {
  return selections.flatMap((selection) =>
    (selection.options ?? selection.optionIds.map((optionId) => ({ optionId, quantity: 1 }))).map(
      (option) => ({
        modifierGroupId: selection.modifierGroupId,
        modifierOptionId: option.optionId,
        quantity: option.quantity,
      }),
    ),
  );
}

function createSelectionSnapshots(
  product: {
    modifierGroups: Array<{
      id: string;
      position: number;
      modifierGroup: { name: string };
      options: Array<{
        optionId: string;
        priceAdjustment: { toString(): string };
        option: { name: string; position: number };
      }>;
    }>;
  },
  selections: Array<{
    groupId: string;
    modifierGroupId: string;
    options?: Array<{ optionId: string; quantity: number; unitPriceAdjustment: string }>;
    optionIds: string[];
  }>,
) {
  const selectedOptions = new Map(
    selections.map((selection) => [
      selection.groupId,
      new Map(
        (
          selection.options ??
          selection.optionIds.map((optionId) => ({
            optionId,
            quantity: 1,
            unitPriceAdjustment: undefined,
          }))
        ).map((option) => [option.optionId, option]),
      ),
    ]),
  );
  return product.modifierGroups.flatMap((group) =>
    group.options
      .filter((option) => selectedOptions.get(group.id)?.has(option.optionId))
      .map((option) => {
        const selection = selectedOptions.get(group.id)!.get(option.optionId)!;
        return {
          modifierGroupId: group.id,
          modifierOptionId: option.optionId,
          groupName: group.modifierGroup.name,
          optionName: option.option.name,
          quantity: selection.quantity,
          priceAdjustment: selection.unitPriceAdjustment ?? option.priceAdjustment.toString(),
          groupPosition: group.position,
          optionPosition: option.option.position,
        };
      }),
  );
}
