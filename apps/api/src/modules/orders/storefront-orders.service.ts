import { createHash } from 'node:crypto';
import { RestaurantOrderPolicyService } from '../storefront/index.js';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type {
  CreateStorefrontOrderRequest,
  CursorPage,
  StorefrontOrderReceipt,
  StorefrontOrderStatus,
  StorefrontOrderSummary,
  OrderDiscountSnapshot,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { assertScopedCursor, type CursorPageQuery } from '../../common/http/pagination.js';
import { formatCents, toCents } from '../../common/money/money.js';
import { isSerializationConflict } from '../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { ProductConsumptionService, ProductPricingService } from '../catalog/index.js';
import { InventoryLedgerService } from '../inventory/index.js';
import { SubscriptionService } from '../subscriptions/index.js';

import { toReceipt, toSummary } from './order.mapper.js';
import { posKitchenTicketInclude } from './pos-kitchen.persistence.js';
import { freezeLineStockRequirements, restoreOrderConsumption } from './order-stock.persistence.js';

const MAX_ORDER_TOTAL_CENTS = 999_999_999_999n;
function cairoToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts();
  return `${parts.find((part) => part.type === 'year')!.value}-${parts.find((part) => part.type === 'month')!.value}-${parts.find((part) => part.type === 'day')!.value}`;
}

@Injectable()
export class StorefrontOrdersService {
  private readonly consumption: ProductConsumptionService;
  private readonly ledger: InventoryLedgerService;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProductPricingService) private readonly products: ProductPricingService,
    @Optional() @Inject(ProductConsumptionService) consumption?: ProductConsumptionService,
    @Optional() @Inject(InventoryLedgerService) ledger?: InventoryLedgerService,
    @Optional()
    @Inject(SubscriptionService)
    private readonly subscriptions: SubscriptionService = new SubscriptionService(prisma),
    @Optional()
    @Inject(RestaurantOrderPolicyService)
    private readonly restaurantPolicy: RestaurantOrderPolicyService = new RestaurantOrderPolicyService(),
  ) {
    this.consumption = consumption ?? new ProductConsumptionService();
    this.ledger = ledger ?? new InventoryLedgerService(prisma);
  }

  async quoteCheckout(slug: string, input: CreateStorefrontOrderRequest) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { storefrontSlug: slug },
      select: { id: true },
    });
    if (!merchant) throw new NotFoundException('Storefront was not found.');
    return this.prisma.$transaction(
      async (db) => {
        await this.subscriptions.requireActive(merchant.id, db);
        let subtotal = 0n;
        const unitPrices: string[] = [];
        for (const item of input.items) {
          const quote = await this.products.quoteForMerchant(
            merchant.id,
            item.productId,
            item.selections,
            item.variantId,
            item.quantity,
            db,
          );
          unitPrices.push(quote.totalPrice);
          subtotal += toCents(quote.totalPrice) * BigInt(item.quantity);
        }
        const coupon = await this.quoteDiscount(db, merchant.id, input.discountCode, subtotal);
        const policy = await this.restaurantPolicy.assess(
          db,
          merchant.id,
          input.fulfillmentType,
          subtotal,
          input.deliveryAreaId,
        );
        if (policy) await this.resolveRestaurantBranch(db, merchant.id);
        const total =
          subtotal -
          (coupon?.snapshot.amount ? toCents(coupon.snapshot.amount) : 0n) +
          (policy?.fee ?? 0n);
        if (total > MAX_ORDER_TOTAL_CENTS)
          throw new BadRequestException('Order total exceeds the supported range.');
        return {
          unitPrices,
          subtotal: formatCents(subtotal),
          deliveryFee: formatCents(policy?.fee ?? 0n),
          total: formatCents(total),
          currency: 'EGP' as const,
          ...(coupon ? { discount: coupon.snapshot } : {}),
          ...(policy ? { restaurantSettingsRevision: policy.snapshot.revision } : {}),
          demo: false,
        };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async create(slug: string, input: CreateStorefrontOrderRequest): Promise<StorefrontOrderReceipt> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { storefrontSlug: slug },
      select: { id: true },
    });
    if (!merchant) throw new NotFoundException('Storefront was not found.');

    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ ...input, requestId: undefined }))
      .digest('hex');
    const replay = async () => {
      if (!input.requestId) return null;
      const existing = await this.prisma.storefrontOrder.findUnique({
        where: { merchantId_requestId: { merchantId: merchant.id, requestId: input.requestId } },
        include: { discountRedemption: true },
      });
      if (!existing) return null;
      if (existing.requestFingerprint !== fingerprint)
        throw new ConflictException('This request ID was used for another checkout.');
      return toReceipt(existing);
    };
    const previous = await replay();
    if (previous) return previous;

    // The browser never supplies prices. Reuse the catalog quote validator for every line.
    const quotes = await Promise.all(
      input.items.map((item) =>
        this.products.quote(item.productId, item.selections, item.variantId, slug, item.quantity),
      ),
    );

    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          await this.subscriptions.requireActive(merchant.id, transaction);
          const order = await transaction.storefrontOrder.create({
            data: {
              merchant: { connect: { id: merchant.id } },
              customerName: input.customerName.trim(),
              customerPhone: input.customerPhone.trim(),
              fulfillmentType: input.fulfillmentType,
              deliveryAddress:
                input.fulfillmentType === 'delivery' ? input.deliveryAddress!.trim() : null,
              total: '0.00',
              ...(input.requestId
                ? { requestId: input.requestId, requestFingerprint: fingerprint }
                : {}),
            },
            select: { id: true },
          });
          let orderTotalCents = 0n;

          for (const [position, item] of input.items.entries()) {
            const quote = quotes[position]!;
            const product = await transaction.product.findFirst({
              where: {
                id: item.productId,
                merchantId: merchant.id,
                archivedAt: null,
              },
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
            if (!product || product.availability !== 'available') {
              throw new ConflictException('A product in this order is no longer available.');
            }
            if (product.revision !== quote.productRevision) {
              throw new ConflictException('A product changed while this order was being placed.');
            }

            const variant = quote.variantId
              ? product.variants.find((candidate) => candidate.id === quote.variantId)
              : undefined;
            if (product.variants.length > 0 && !variant) {
              throw new ConflictException('A selected variant is no longer available.');
            }
            if (variant && variant.availability !== 'available') {
              throw new ConflictException('A selected variant is no longer available.');
            }

            const recipeHandling = product.inventoryConfiguration?.mode === 'RECIPE';
            let stockReserved = false;
            if (
              !recipeHandling &&
              variant?.stockQuantity !== null &&
              variant?.stockQuantity !== undefined
            ) {
              const reservation = await transaction.productVariant.updateMany({
                where: {
                  id: variant.id,
                  merchantId: merchant.id,
                  productId: product.id,
                  availability: 'available',
                  stockQuantity: { gte: item.quantity },
                },
                data: { stockQuantity: { decrement: item.quantity } },
              });
              if (reservation.count !== 1) {
                throw new ConflictException('A selected variant does not have enough stock.');
              }
              stockReserved = true;
            }

            const selectedOptions = new Map(
              quote.selections.map((selection) => [
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
            const selectionSnapshots = product.modifierGroups.flatMap((group) =>
              group.options
                .filter((option) => selectedOptions.get(group.id)?.has(option.optionId))
                .map((option) => ({
                  modifierGroupId: group.modifierGroupId,
                  modifierOptionId: option.optionId,
                  groupName: group.modifierGroup.name,
                  optionName: option.option.name,
                  quantity: selectedOptions.get(group.id)!.get(option.optionId)!.quantity,
                  priceAdjustment:
                    selectedOptions.get(group.id)!.get(option.optionId)!.unitPriceAdjustment ??
                    option.priceAdjustment.toString(),
                  groupPosition: group.position,
                  optionPosition: option.option.position,
                })),
            );
            const variantAttributeSnapshots =
              variant?.attributeSelections.map((selection) => ({
                attributeId: selection.attributeId,
                valueId: selection.valueId,
                attributeName: selection.attribute.name,
                attributeValue: selection.value.value,
                position: selection.attribute.position,
              })) ?? [];
            const unitPriceCents = toCents(quote.totalPrice);
            const lineTotalCents = unitPriceCents * BigInt(item.quantity);
            orderTotalCents += lineTotalCents;
            if (orderTotalCents > MAX_ORDER_TOTAL_CENTS) {
              throw new BadRequestException('The order total is too large.');
            }

            const savedLine = await transaction.storefrontOrderLine.create({
              data: {
                order: { connect: { id_merchantId: { id: order.id, merchantId: merchant.id } } },
                productId: product.id,
                variantId: variant?.id ?? null,
                productName: product.name,
                variantName: variant?.name ?? null,
                note: null,
                basePrice: quote.basePrice,
                modifierTotal: quote.modifierTotal,
                quantity: item.quantity,
                unitPrice: formatCents(unitPriceCents),
                lineTotal: formatCents(lineTotalCents),
                stockHandling: recipeHandling ? 'recipe_acceptance' : 'legacy',
                stockReserved,
                position,
                selections: { create: selectionSnapshots },
                variantAttributes: { create: variantAttributeSnapshots },
              },
              select: { id: true },
            });
            if (recipeHandling) {
              const requirements = await this.consumption.requirements(transaction, merchant.id, [
                {
                  productId: product.id,
                  variantId: variant?.id ?? null,
                  quantity: item.quantity,
                  selections: selectionSnapshots.map((selection) => ({
                    modifierGroupId: selection.modifierGroupId,
                    modifierOptionId: selection.modifierOptionId,
                    quantity: selection.quantity,
                  })),
                },
              ]);
              await freezeLineStockRequirements(
                transaction,
                merchant.id,
                savedLine.id,
                requirements,
              );
            }
          }

          const coupon = await this.quoteDiscount(
            transaction,
            merchant.id,
            input.discountCode,
            orderTotalCents,
          );
          const discountCents = coupon?.snapshot.amount ? toCents(coupon.snapshot.amount) : 0n;
          const policy = await this.restaurantPolicy.assess(
            transaction,
            merchant.id,
            input.fulfillmentType,
            orderTotalCents,
            input.deliveryAreaId,
            input.restaurantSettingsRevision,
          );
          const receivingBranch = policy
            ? await this.resolveRestaurantBranch(transaction, merchant.id)
            : null;
          const deliveryFeeCents = policy?.fee ?? 0n;
          const totalCents = orderTotalCents - discountCents + deliveryFeeCents;
          if (input.reviewedTotal !== undefined && toCents(input.reviewedTotal) !== totalCents)
            throw new ConflictException(
              'Checkout total changed. Review the new price before confirming.',
            );
          if (totalCents > MAX_ORDER_TOTAL_CENTS)
            throw new BadRequestException('Order total exceeds the supported range.');
          if (coupon && discountCents > 0n) {
            const today = cairoToday();
            const changed = await transaction.merchantDiscount.updateMany({
              where: {
                id: coupon.row.id,
                merchantId: merchant.id,
                revision: coupon.row.revision,
                usedCount: coupon.row.usedCount,
                state: 'published',
                startDate: { lte: new Date(`${today}T00:00:00.000Z`) },
                endDate: { gte: new Date(`${today}T00:00:00.000Z`) },
                ...(coupon.row.usageLimit === null
                  ? {}
                  : { usageLimit: { gt: coupon.row.usedCount } }),
              },
              data: { usedCount: { increment: 1 } },
            });
            if (changed.count !== 1)
              throw new ConflictException(
                'Discount code is no longer available. Review your order and try again.',
              );
            await transaction.merchantDiscountRedemption.create({
              data: {
                merchantId: merchant.id,
                discountId: coupon.row.id,
                orderId: order.id,
                ...coupon.snapshot,
                value: coupon.row.value,
              },
            });
          }
          const saved = await transaction.storefrontOrder.update({
            where: { id: order.id },
            data: {
              total: formatCents(totalCents),
              ...(receivingBranch
                ? { branchId: receivingBranch.id, branchName: receivingBranch.name }
                : {}),
              ...(policy
                ? {
                    subtotal: formatCents(orderTotalCents),
                    deliveryFee: formatCents(deliveryFeeCents),
                    fulfillmentPolicy: policy.snapshot,
                  }
                : {}),
            },
            include: { discountRedemption: true },
          });
          return toReceipt(saved);
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      const completed = await replay();
      if (completed) return completed;
      if (isSerializationConflict(error)) {
        throw new ConflictException('Stock or product configuration changed. Please try again.');
      }
      throw error;
    }
  }

  private async resolveRestaurantBranch(db: Prisma.TransactionClient, merchantId: string) {
    const branches = await db.branch.findMany({
      where: { merchantId, archivedAt: null },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
      take: 2,
    });
    if (branches.length !== 1) {
      throw new ConflictException(
        branches.length === 0
          ? 'المطعم ليس لديه فرع متاح لاستقبال الطلبات حاليًا.'
          : 'يلزم تحديد فرع استقبال طلبات المطعم قبل تأكيد الطلب.',
      );
    }
    return branches[0]!;
  }

  private async quoteDiscount(
    db: Prisma.TransactionClient,
    merchantId: string,
    code: string | undefined,
    subtotal: bigint,
  ) {
    if (!code) return null;
    const normalized = code.trim().toUpperCase();
    const row = await db.merchantDiscount.findFirst({
      where: { merchantId, code: normalized },
      include: { branches: { select: { branchId: true } } },
    });
    const unavailable = () =>
      new BadRequestException('Discount code is not available for this order.');
    const today = cairoToday();
    if (
      !row ||
      row.state !== 'published' ||
      row.startDate.toISOString().slice(0, 10) > today ||
      row.endDate.toISOString().slice(0, 10) < today ||
      (row.usageLimit !== null && row.usedCount >= row.usageLimit) ||
      row.branches.length > 0
    )
      throw unavailable();
    if (subtotal < toCents(row.minimum.toString()))
      throw new BadRequestException('Order does not meet the discount minimum.');
    const value = toCents(row.value.toString());
    let amount = row.type === 'fixed' ? value : (subtotal * value + 5_000n) / 10_000n;
    if (row.maximum !== null)
      amount = amount < toCents(row.maximum.toString()) ? amount : toCents(row.maximum.toString());
    if (amount > subtotal) amount = subtotal;
    if (amount <= 0n) throw unavailable();
    const snapshot: OrderDiscountSnapshot = {
      code: row.code,
      name: row.name,
      type: row.type as OrderDiscountSnapshot['type'],
      value: row.value.toString(),
      amount: formatCents(amount),
      terms: row.terms,
    };
    return { row, snapshot };
  }

  async listForOwner(
    merchantId: string,
    page: CursorPageQuery = { limit: 25 },
  ): Promise<CursorPage<StorefrontOrderSummary>> {
    const where = { merchantId, source: 'storefront' } satisfies Prisma.StorefrontOrderWhereInput;
    if (page.cursor) {
      const anchor = await this.prisma.storefrontOrder.findFirst({
        where: { ...where, id: page.cursor },
        select: { id: true },
      });
      assertScopedCursor(page.cursor, anchor !== null);
    }
    const orders = await this.prisma.storefrontOrder.findMany({
      where,
      include: {
        lines: {
          orderBy: { position: 'asc' },
          include: {
            selections: { orderBy: [{ groupPosition: 'asc' }, { optionPosition: 'asc' }] },
            variantAttributes: { orderBy: { position: 'asc' } },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: page.limit + 1,
      ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {}),
    });
    const hasMore = orders.length > page.limit;
    const items = orders.slice(0, page.limit).map(toSummary);
    return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
  }

  async listForPos(
    merchantId: string,
    branchId: string,
    page: CursorPageQuery = { limit: 25 },
  ): Promise<CursorPage<StorefrontOrderSummary>> {
    const where: Prisma.StorefrontOrderWhereInput = {
      merchantId,
      delivery: { is: null },
      OR: [
        {
          source: 'storefront',
          branchId,
          status: { in: ['pending', 'accepted', 'preparing', 'ready'] },
        },
        {
          lines: { some: { stockHandling: 'recipe_acceptance' } },
          OR: [
            { status: 'pending', OR: [{ source: 'storefront', branchId: null }, { branchId }] },
            { status: { in: ['accepted', 'preparing', 'ready'] }, branchId },
          ],
        },
        {
          source: 'pos',
          branchId,
          status: { in: ['pending', 'accepted', 'preparing', 'ready'] },
          kitchenTicket: { isNot: null },
        },
        {
          source: 'pos',
          branchId,
          status: 'cancelled',
          kitchenTicket: { is: { cancellationAcknowledgedAt: null } },
        },
      ],
    };
    if (page.cursor) {
      const anchor = await this.prisma.storefrontOrder.findFirst({
        where: { ...where, id: page.cursor },
        select: { id: true },
      });
      assertScopedCursor(page.cursor, anchor !== null);
    }
    const orders = await this.prisma.storefrontOrder.findMany({
      where,
      include: {
        kitchenTicket: posKitchenTicketInclude,
        diningSession: { select: { table: { select: { code: true } } } },
        checks: { select: { settledAt: true } },
        lines: {
          orderBy: { position: 'asc' },
          include: {
            selections: { orderBy: [{ groupPosition: 'asc' }, { optionPosition: 'asc' }] },
            variantAttributes: { orderBy: { position: 'asc' } },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: page.limit + 1,
      ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {}),
    });
    const hasMore = orders.length > page.limit;
    const items = orders.slice(0, page.limit).map((order) => {
      const summary = toSummary(order);
      return (order.source === 'pos' && order.kitchenTicket) || (order.source === 'storefront' && order.fulfillmentType === 'pickup' && order.posShiftId)
        ? {
            ...summary,
            handoverEligible:
              order.status === 'ready' &&
              order.checks.length > 0 &&
              order.checks.every((check) => check.settledAt !== null),
          }
        : summary;
    });
    return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
  }

  async updateStatus(
    merchantId: string,
    orderId: string,
    status: Extract<StorefrontOrderStatus, 'accepted' | 'rejected'>,
  ): Promise<StorefrontOrderSummary> {
    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          if (status === 'accepted') {
            const recipe = await transaction.storefrontOrderLine.findFirst({
              where: { merchantId, orderId, stockHandling: 'recipe_acceptance' },
              select: { id: true },
            });
            if (recipe)
              throw new ConflictException('Recipe orders require branch-based acceptance.');
          }
          const changed = await transaction.storefrontOrder.updateMany({
            where: { id: orderId, merchantId, source: 'storefront', status: 'pending' },
            data: { status },
          });
          if (changed.count !== 1) {
            const exists = await transaction.storefrontOrder.findFirst({
              where: { id: orderId, merchantId, source: 'storefront' },
              select: { id: true },
            });
            if (!exists) throw new NotFoundException('Order was not found.');
            throw new ConflictException('Only pending orders can be accepted or rejected.');
          }

          if (status === 'rejected') {
            await restoreOrderConsumption(
              transaction,
              this.ledger,
              merchantId,
              'owner:order-rejection',
              orderId,
              'Rejected order stock reversal',
            );
            const reservedLines = await transaction.storefrontOrderLine.findMany({
              where: { orderId, merchantId, stockReserved: true, variantId: { not: null } },
              select: { variantId: true, quantity: true },
            });
            for (const line of reservedLines) {
              if (!line.variantId) continue;
              await transaction.productVariant.updateMany({
                where: {
                  id: line.variantId,
                  merchantId,
                  stockQuantity: { not: null },
                },
                data: { stockQuantity: { increment: line.quantity } },
              });
            }
          }

          const saved = await transaction.storefrontOrder.findFirst({
            where: { id: orderId, merchantId },
            include: {
              lines: {
                orderBy: { position: 'asc' },
                include: {
                  selections: { orderBy: [{ groupPosition: 'asc' }, { optionPosition: 'asc' }] },
                  variantAttributes: { orderBy: { position: 'asc' } },
                },
              },
            },
          });
          if (!saved) throw new NotFoundException('Order was not found.');
          return toSummary(saved);
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (isSerializationConflict(error)) {
        throw new ConflictException('Order changed while it was being updated. Please retry.');
      }
      throw error;
    }
  }
}
