/**
 * Reviews prices and confirms a cashier sale with its items, stock effects and first bill.
 */
import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import type {
  CreatePosOrderResponse,
  PosEmployeeSession,
  PosOrderQuoteResponse,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';

import { createHash } from 'node:crypto';
import { formatCents, toCents } from '../../../common/money/money.js';

import {
  isSerializationConflict,
  isUniqueConstraintError,
} from '../../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import {
  ProductConsumptionService,
  ProductPricingService,
  type InventoryRequirement,
} from '../../catalog/index.js';
import { InventoryLedgerService } from '../../inventory/index.js';
import { ShiftsService } from '../../shifts/index.js';

import { PosDiningService } from '../dining/pos-dining.service.js';

import {
  createPosKitchenTicket,
  posKitchenTicketInclude,
} from '../kitchen/pos-kitchen.persistence.js';
import { toSummary } from '../mapping/order.mapper.js';
import {
  allocatePosBranchOrderNumber,
  allocatePosOrderReference,
} from './pos-order-number.persistence.js';
import {
  consumeDirectOrderRequirements,
  assertKnownCurrentCosts,
  freezeLineStockRequirements,
  resolveConsumptionWarehouse,
  saveLineCostSnapshots,
} from '../stock/order-stock.persistence.js';
import { parseCreatePosOrderRequest, parsePosOrderQuoteRequest } from './pos-orders.schemas.js';

const MAX_ORDER_TOTAL_CENTS = 999_999_999_999n;
const orderSummaryInclude = {
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

import {
  quotePosSaleItems,
  requirePosSellPermission,
  replayPosSale,
  quoteSelectionsForRequirements,
  createSelectionSnapshots,
} from './pos-order.rules.js';

@Injectable()
export class PosSaleService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProductPricingService) private readonly pricing: ProductPricingService,
    @Inject(ProductConsumptionService) private readonly consumption: ProductConsumptionService,
    @Inject(InventoryLedgerService) private readonly ledger: InventoryLedgerService,
    @Inject(ShiftsService) private readonly shifts: ShiftsService,
    @Inject(PosDiningService) private readonly dining: PosDiningService,
  ) {}

  async quote(employee: PosEmployeeSession, input: unknown): Promise<PosOrderQuoteResponse> {
    requirePosSellPermission(employee);
    const request = parsePosOrderQuoteRequest(input);
    return quotePosSaleItems(this.pricing, employee.merchantId, request);
  }

  async create(employee: PosEmployeeSession, input: unknown): Promise<CreatePosOrderResponse> {
    requirePosSellPermission(employee);
    // 1. Validate the sale command before opening its transaction.
    const request = parseCreatePosOrderRequest(input);
    const actor = `pos:${employee.id}`;
    const fingerprint = createHash('sha256').update(JSON.stringify(request)).digest('hex');
    for (let attempt = 0; ; attempt++) {
      try {
        // 2. Commit the sale, stock effects and saved retry result together.
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
            if (previous) return replayPosSale(previous, actor, fingerprint);

            const shift = await this.shifts.lockOpenShiftForSale(tx, employee, request.registerId);
            const quote = await quotePosSaleItems(this.pricing, employee.merchantId, request, tx);
            const orderTotalCents = toCents(quote.total);
            const orderReference = await allocatePosOrderReference(
              tx,
              employee.merchantId,
              shift.branchId,
            );
            const branchOrderNumber = await allocatePosBranchOrderNumber(
              tx,
              employee.merchantId,
              shift.branchOrderSessionId,
            );
            const order = await tx.storefrontOrder.create({
              data: {
                merchantId: employee.merchantId,
                orderReference,
                branchOrderSessionId: shift.branchOrderSessionId,
                branchOrderNumber,
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
            const revenueRecognizedAt = new Date();
            let hasDirectStock = false;

            for (const [position, item] of request.items.entries()) {
              const product = await tx.product.findFirst({
                where: { id: item.productId, merchantId: employee.merchantId, archivedAt: null },
                select: {
                  id: true,
                  name: true,
                  menuSection: { select: { id: true, name: true } },
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
              if (!mode)
                throw new ConflictException(
                  'Configure this product inventory and record current item costs before selling it.',
                );
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
                await assertKnownCurrentCosts(tx, employee.merchantId, requirements);
                if (mode === 'DIRECT') {
                  hasDirectStock = true;
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
                  menuSectionIdAtSale: product.menuSection?.id ?? null,
                  menuSectionNameAtSale: product.menuSection?.name ?? null,
                  variantName: variant?.name ?? null,
                  basePrice: lineQuote.basePrice,
                  modifierTotal: lineQuote.modifierTotal,
                  promotionType: lineQuote.promotion?.type ?? null,
                  promotionValue: lineQuote.promotion?.value ?? null,
                  promotionDiscount: lineQuote.promotion?.discountAmount ?? '0.00',
                  quantity: item.quantity,
                  unitPrice: lineQuote.totalPrice,
                  lineTotal: formatCents(lineTotalCents),
                  recognizedRevenueAmount: formatCents(lineTotalCents),
                  revenueRecognizedAt,
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
              if (mode === 'DIRECT') directRequirementsByLine.set(savedLine.id, requirements);
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
            if (request.fulfillmentType !== 'dine_in') {
              await createPosKitchenTicket(tx, {
                merchantId: employee.merchantId,
                branchId: shift.branchId,
                orderId: order.id,
                dispatchMode: 'automatic',
                dispatchedByPosEmployeeId: employee.id,
              });
            }
            if (hasDirectStock) {
              const warehouse = await resolveConsumptionWarehouse(
                tx,
                employee.merchantId,
                shift.branchId,
              );
              const requirements = [...directRequirementsByLine.values()].flat();
              const capturedCosts = await consumeDirectOrderRequirements(
                tx,
                this.ledger,
                employee.merchantId,
                actor,
                order.id,
                warehouse.id,
                requirements,
              );
              for (const [orderLineId, lineRequirements] of directRequirementsByLine) {
                await saveLineCostSnapshots(
                  tx,
                  employee.merchantId,
                  orderLineId,
                  lineRequirements,
                  capturedCosts,
                );
              }
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
              merchantId_requestId: {
                merchantId: employee.merchantId,
                requestId: request.requestId,
              },
            },
          });
          if (previous) return replayPosSale(previous, actor, fingerprint);
          if (isUniqueConstraintError(error))
            throw new ConflictException('This sale request conflicts with an existing command.');
        }
        if (isSerializationConflict(error) && attempt < 4) continue;
        if (isSerializationConflict(error))
          throw new ConflictException('The order or stock changed. Review the cart and retry.');
        throw error;
      }
    }
  }
}
