import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateStorefrontOrderRequest,
  StorefrontOrderReceipt,
  StorefrontOrderSummary,
  StorefrontOrderStatus,
} from '@waffarly/contracts';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { ProductService } from './product.service.js';

const MAX_ORDER_TOTAL_CENTS = 999_999_999_999n;

@Injectable()
export class StorefrontOrdersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProductService) private readonly products: ProductService,
  ) {}

  async create(
    slug: string,
    input: CreateStorefrontOrderRequest,
  ): Promise<StorefrontOrderReceipt> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { storefrontSlug: slug },
      select: { id: true },
    });
    if (!merchant) throw new NotFoundException('Storefront was not found.');

    // The browser never supplies prices. Reuse the catalog quote validator for every line.
    const quotes = await Promise.all(
      input.items.map((item) =>
        this.products.quote(item.productId, item.selections, item.variantId, slug),
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
                variants: {
                  select: {
                    id: true,
                    name: true,
                    availability: true,
                    stockQuantity: true,
                  },
                },
                modifierGroups: {
                  orderBy: { position: 'asc' },
                  select: {
                    id: true,
                    name: true,
                    position: true,
                    options: {
                      orderBy: { position: 'asc' },
                      select: {
                        id: true,
                        name: true,
                        priceAdjustment: true,
                        position: true,
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

            let stockReserved = false;
            if (variant?.stockQuantity !== null && variant?.stockQuantity !== undefined) {
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

            const selectedOptions = new Map<string, Set<string>>(
              quote.selections.map((selection) => [
                selection.groupId,
                new Set(selection.optionIds),
              ]),
            );
            const selectionSnapshots = product.modifierGroups.flatMap((group) =>
              group.options
                .filter((option) => selectedOptions.get(group.id)?.has(option.id))
                .map((option) => ({
                  groupName: group.name,
                  optionName: option.name,
                  priceAdjustment: option.priceAdjustment.toString(),
                  groupPosition: group.position,
                  optionPosition: option.position,
                })),
            );
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
                quantity: item.quantity,
                unitPrice: formatCents(unitPriceCents),
                lineTotal: formatCents(lineTotalCents),
                stockReserved,
                position,
                selections: { create: selectionSnapshots },
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

  async listForOwner(merchantId: string): Promise<StorefrontOrderSummary[]> {
    const orders = await this.prisma.storefrontOrder.findMany({
      where: { merchantId },
      include: {
        lines: {
          orderBy: { position: 'asc' },
          include: { selections: { orderBy: [{ groupPosition: 'asc' }, { optionPosition: 'asc' }] } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return orders.map(toSummary);
  }

  async updateStatus(
    merchantId: string,
    orderId: string,
    status: Extract<StorefrontOrderStatus, 'accepted' | 'rejected'>,
  ): Promise<StorefrontOrderSummary> {
    try {
      return await this.prisma.$transaction(
        async (transaction) => {
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

function toReceipt(order: {
  id: string;
  status: string;
  total: { toString(): string };
  currency: string;
  createdAt: Date;
}): StorefrontOrderReceipt {
  return {
    id: order.id,
    status: order.status as StorefrontOrderStatus,
    currency: 'EGP',
    total: formatCents(toCents(order.total.toString())),
    createdAt: order.createdAt.toISOString(),
  };
}

function toSummary(order: {
  id: string;
  status: string;
  customerName: string;
  customerPhone: string;
  fulfillmentType: string;
  deliveryAddress: string | null;
  total: { toString(): string };
  createdAt: Date;
  lines: Array<{
    id: string;
    productName: string;
    variantName: string | null;
    quantity: number;
    unitPrice: { toString(): string };
    lineTotal: { toString(): string };
    selections: Array<{
      groupName: string;
      optionName: string;
      priceAdjustment: { toString(): string };
    }>;
  }>;
}): StorefrontOrderSummary {
  return {
    id: order.id,
    status: order.status as StorefrontOrderStatus,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    fulfillmentType: order.fulfillmentType as 'pickup' | 'delivery',
    deliveryAddress: order.deliveryAddress,
    currency: 'EGP',
    total: formatCents(toCents(order.total.toString())),
    createdAt: order.createdAt.toISOString(),
    lines: order.lines.map((line) => ({
      id: line.id,
      productName: line.productName,
      variantName: line.variantName,
      quantity: line.quantity,
      unitPrice: formatCents(toCents(line.unitPrice.toString())),
      lineTotal: formatCents(toCents(line.lineTotal.toString())),
      selections: line.selections.map((selection) => ({
        groupName: selection.groupName,
        optionName: selection.optionName,
        priceAdjustment: formatCents(toCents(selection.priceAdjustment.toString())),
      })),
    })),
  };
}

function toCents(value: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) throw new ConflictException('Product has an invalid price configuration.');
  return BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
}

function formatCents(value: bigint): string {
  return `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`;
}

function isSerializationConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2034'
  );
}
