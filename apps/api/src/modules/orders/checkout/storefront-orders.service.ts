/**
 * Coordinates website checkout from the basket review to the saved order.
 * Marketplace uses the same flow with customer or guest ownership attached.
 */
import { saveCheckoutLine } from './save-checkout-line.js';
import {
  currentCairoDate,
  quoteCheckoutDiscount,
  resolveRestaurantReceivingBranch,
} from './checkout-policy.js';
import { updateStorefrontOrderStatus } from '../fulfillment/update-storefront-order-status.js';
import {
  listOwnerStorefrontOrders,
  listBranchOrderQueue,
} from '../fulfillment/order-queue.query.js';
import { createHash } from 'node:crypto';
import { orderIdentityWhere, type OrderIdentity } from '../customers/order-identity.rules.js';
import { RestaurantOrderPolicyService } from '../../storefront/index.js';

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
  StorefrontOrderReceipt,
  StorefrontOrderStatus,
  StorefrontOrderSummary,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { type CursorPageQuery } from '../../../common/http/pagination.js';
import { formatCents, toCents } from '../../../common/money/money.js';
import { isSerializationConflict } from '../../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { ProductConsumptionService, ProductPricingService } from '../../catalog/index.js';
import { InventoryLedgerService } from '../../inventory/index.js';
import { SubscriptionService } from '../../subscriptions/index.js';

import { toReceipt } from '../mapping/order.mapper.js';

const MAX_ORDER_TOTAL_CENTS = 999_999_999_999n;
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
        const coupon = await quoteCheckoutDiscount(db, merchant.id, input.discountCode, subtotal);
        const policy = await this.restaurantPolicy.assess(
          db,
          merchant.id,
          input.fulfillmentType,
          subtotal,
          input.deliveryAreaId,
        );
        if (policy) await resolveRestaurantReceivingBranch(db, merchant.id);
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

  async create(
    slug: string,
    input: CreateStorefrontOrderRequest,
    identity?: OrderIdentity,
    replayScope?: Prisma.CustomerOrderAccessWhereInput,
  ): Promise<StorefrontOrderReceipt> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { storefrontSlug: slug },
      select: { id: true },
    });
    if (!merchant) throw new NotFoundException('Storefront was not found.');

    // 1. Bind retries to the exact checkout payload.
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
      if (
        identity &&
        !(await this.prisma.customerOrderAccess.findFirst({
          where: { AND: [replayScope ?? orderIdentityWhere(identity), { orderId: existing.id }] },
          select: { orderId: true },
        }))
      )
        throw new NotFoundException('Order was not found.');
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
      // 2. Save the order, its stock commitments and customer access together.
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
            // 3. Save the item as sold and reserve or freeze its stock needs.
            orderTotalCents = await saveCheckoutLine(
              transaction,
              this.consumption,
              merchant.id,
              order.id,
              item,
              quote,
              position,
              orderTotalCents,
            );
          }

          // 4. Recheck the discount and restaurant rules before fixing the final total.
          const coupon = await quoteCheckoutDiscount(
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
            ? await resolveRestaurantReceivingBranch(transaction, merchant.id)
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
            const today = currentCairoDate();
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
          // 5. Save the agreed total and attach the customer or guest when supplied.
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
          if (identity)
            await transaction.customerOrderAccess.create({
              data: { orderId: saved.id, merchantId: merchant.id, ...identity },
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

  async listForOwner(merchantId: string, page: CursorPageQuery = { limit: 25 }) {
    return listOwnerStorefrontOrders(this.prisma, merchantId, page);
  }

  async listForPos(merchantId: string, branchId: string, page: CursorPageQuery = { limit: 25 }) {
    return listBranchOrderQueue(this.prisma, merchantId, branchId, page);
  }

  updateStatus(
    merchantId: string,
    orderId: string,
    status: Extract<StorefrontOrderStatus, 'accepted' | 'rejected'>,
  ): Promise<StorefrontOrderSummary> {
    return updateStorefrontOrderStatus(this.prisma, this.ledger, merchantId, orderId, status);
  }
}
