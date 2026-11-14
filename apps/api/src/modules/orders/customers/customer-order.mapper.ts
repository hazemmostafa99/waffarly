/**
 * Prepares the order details a customer may see, leaving out staff-only and private information.
 */
import type { Prisma } from '@waffarly/database';

export const customerOrderProjection = {
  orderId: true,
  accountId: true,
  order: {
    select: {
      id: true,
      status: true,
      createdAt: true,
      total: true,
      subtotal: true,
      deliveryFee: true,
      fulfillmentType: true,
      acceptedAt: true,
      preparationStartedAt: true,
      readyAt: true,
      completedAt: true,
      cancelledAt: true,
      merchant: { select: { name: true } },
      lines: {
        orderBy: { position: 'asc' as const },
        select: {
          id: true,
          productName: true,
          variantName: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          selections: {
            orderBy: [{ groupPosition: 'asc' as const }, { optionPosition: 'asc' as const }],
            select: { groupName: true, optionName: true, quantity: true },
          },
        },
      },
    },
  },
} satisfies Prisma.CustomerOrderAccessSelect;
type Row = Prisma.CustomerOrderAccessGetPayload<{ select: typeof customerOrderProjection }>;
export function toCustomerOrderDetails(row: Row) {
  const order = row.order;
  return {
    id: order.id,
    restaurantName: order.merchant.name,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    total: order.total.toFixed(2),
    subtotal: order.subtotal?.toFixed(2) ?? null,
    deliveryFee: order.deliveryFee?.toFixed(2) ?? null,
    fulfillmentType: order.fulfillmentType,
    guest: row.accountId === null,
    acceptedAt: order.acceptedAt?.toISOString() ?? null,
    preparationStartedAt: order.preparationStartedAt?.toISOString() ?? null,
    readyAt: order.readyAt?.toISOString() ?? null,
    completedAt: order.completedAt?.toISOString() ?? null,
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    items: order.lines.map((line) => ({
      ...line,
      unitPrice: line.unitPrice.toFixed(2),
      lineTotal: line.lineTotal.toFixed(2),
    })),
  };
}
