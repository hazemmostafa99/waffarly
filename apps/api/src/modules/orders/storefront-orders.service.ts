import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateStorefrontOrderRequest,
  CursorPage,
  StorefrontOrderReceipt,
  StorefrontOrderStatus,
  StorefrontOrderSummary,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { assertScopedCursor, type CursorPageQuery } from '../../common/http/pagination.js';
import { formatCents, toCents } from '../../common/money/money.js';
import { isSerializationConflict } from '../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { ProductPricingService } from '../catalog/index.js';

import { toReceipt, toSummary } from './order.mapper.js';

const MAX_ORDER_TOTAL_CENTS = 999_999_999_999n;

@Injectable()
export class StorefrontOrdersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProductPricingService) private readonly products: ProductPricingService,
  ) {}

  async create(slug: string, input: CreateStorefrontOrderRequest): Promise<StorefrontOrderReceipt> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { storefrontSlug: slug },
      select: { id: true },
    });
    if (!merchant) throw new NotFoundException('Storefront was not found.');

    // The browser never supplies prices. Reuse the catalog quote validator for every line.
    const quotes = await Promise.all(
      input.items.map((item) =>
        this.products.quote(item.productId, item.selections, item.variantId, slug, item.quantity),
      ),
    );

    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const order = await transaction.storefrontOrder.create({
            data: {
              merchant: { connect: { id: merchant.id } },
              customerName: input.customerName.trim(),
              customerPhone: input.customerPhone.trim(),
              fulfillmentType: input.fulfillmentType,
              deliveryAddress:
                input.fulfillmentType === 'delivery' ? input.deliveryAddress!.trim() : null,
              total: '0.00',
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

            await transaction.storefrontOrderLine.create({
              data: {
                order: { connect: { id_merchantId: { id: order.id, merchantId: merchant.id } } },
                productId: product.id,
                variantId: variant?.id ?? null,
                productName: product.name,
                variantName: variant?.name ?? null,
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
            });
          }

          const saved = await transaction.storefrontOrder.update({
            where: { id: order.id },
            data: { total: formatCents(orderTotalCents) },
            select: { id: true, status: true, total: true, currency: true, createdAt: true },
          });
          return toReceipt(saved);
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (isSerializationConflict(error)) {
        throw new ConflictException('Stock or product configuration changed. Please try again.');
      }
      throw error;
    }
  }

  async listForOwner(
    merchantId: string,
    page: CursorPageQuery = { limit: 25 },
  ): Promise<CursorPage<StorefrontOrderSummary>> {
    if (page.cursor) {
      const anchor = await this.prisma.storefrontOrder.findFirst({
        where: { id: page.cursor, merchantId },
        select: { id: true },
      });
      assertScopedCursor(page.cursor, anchor !== null);
    }
    const orders = await this.prisma.storefrontOrder.findMany({
      where: { merchantId },
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
      lines: { some: { stockHandling: 'recipe_acceptance' } },
      OR: [{ status: 'pending' }, { status: { in: ['accepted', 'preparing'] }, branchId }],
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
            where: { id: orderId, merchantId, status: 'pending' },
            data: { status },
          });
          if (changed.count !== 1) {
            const exists = await transaction.storefrontOrder.findFirst({
              where: { id: orderId, merchantId },
              select: { id: true },
            });
            if (!exists) throw new NotFoundException('Order was not found.');
            throw new ConflictException('Only pending orders can be accepted or rejected.');
          }

          if (status === 'rejected') {
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
