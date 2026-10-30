import type {
  StorefrontOrderReceipt,
  StorefrontOrderSummary,
  StorefrontOrderStatus,
} from '@waffarly/contracts';
import { formatCents, toCents } from '../../common/money/money.js';
export function toReceipt(order: {
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

export function toSummary(order: {
  orderReference?: string | null;
  branchId?: string | null;
  warehouseId?: string | null;
  branchName?: string | null;
  warehouseName?: string | null;
  acceptedAt?: Date | null;
  preparationStartedAt?: Date | null;
  readyAt?: Date | null;
  completedAt?: Date | null;
  cancelledAt?: Date | null;
  cancellationReason?: string | null;
  stockRestored?: boolean | null;
  kitchenTicket?: {
    id: string;
    dispatchMode: string;
    dispatchedAt: Date;
    cancellationAcknowledgedAt?: Date | null;
    station: { id: string; name: string };
  } | null;
  diningSession?: { table: { code: string } } | null;
  id: string;
  status: string;
  customerName: string | null;
  customerPhone: string | null;
  fulfillmentType: string;
  deliveryAddress: string | null;
  total: { toString(): string };
  createdAt: Date;
  lines: Array<{
    id: string;
    stockHandling?: string;
    productName: string;
    variantName: string | null;
    basePrice: { toString(): string } | null;
    modifierTotal: { toString(): string } | null;
    quantity: number;
    unitPrice: { toString(): string };
    lineTotal: { toString(): string };
    note?: string | null;
    kitchenReadyAt?: Date | null;
    variantAttributes: Array<{
      attributeId: string | null;
      valueId: string | null;
      attributeName: string;
      attributeValue: string;
      position: number;
    }>;
    selections: Array<{
      modifierGroupId: string | null;
      modifierOptionId: string | null;
      groupName: string;
      optionName: string;
      quantity?: number;
      priceAdjustment: { toString(): string };
    }>;
  }>;
}): StorefrontOrderSummary {
  return {
    ...(order.orderReference !== undefined ? { orderReference: order.orderReference } : {}),
    ...(order.cancelledAt !== undefined
      ? { cancelledAt: order.cancelledAt?.toISOString() ?? null }
      : {}),
    ...(order.cancellationReason !== undefined
      ? { cancellationReason: order.cancellationReason }
      : {}),
    ...(order.kitchenTicket
      ? {
          kitchenTicket: {
            id: order.kitchenTicket.id,
            station: order.kitchenTicket.station,
            dispatchMode: order.kitchenTicket.dispatchMode as 'automatic' | 'manual' | 'legacy',
            dispatchedAt: order.kitchenTicket.dispatchedAt.toISOString(),
            cancellationAcknowledgedAt:
              order.kitchenTicket.cancellationAcknowledgedAt?.toISOString() ?? null,
          },
        }
      : order.kitchenTicket === null
        ? { kitchenTicket: null }
        : {}),
    ...(order.diningSession !== undefined
      ? { tableCode: order.diningSession?.table.code ?? null }
      : {}),
    ...(order.readyAt !== undefined ? { readyAt: order.readyAt?.toISOString() ?? null } : {}),
    ...(order.completedAt !== undefined
      ? { completedAt: order.completedAt?.toISOString() ?? null }
      : {}),
    ...(order.lines.some((line) => line.stockHandling === 'recipe_acceptance')
      ? {
          requiresRecipeAcceptance: true,
          inventoryLifecycle: {
            branchId: order.branchId ?? null,
            warehouseId: order.warehouseId ?? null,
            branchName: order.branchName ?? null,
            warehouseName: order.warehouseName ?? null,
            acceptedAt: order.acceptedAt?.toISOString() ?? null,
            preparationStartedAt: order.preparationStartedAt?.toISOString() ?? null,
            cancelledAt: order.cancelledAt?.toISOString() ?? null,
            cancellationReason: order.cancellationReason ?? null,
            stockRestored: order.stockRestored ?? null,
          },
        }
      : {}),
    id: order.id,
    status: order.status as StorefrontOrderStatus,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    fulfillmentType: order.fulfillmentType as 'pickup' | 'delivery' | 'dine_in' | 'takeaway',
    deliveryAddress: order.deliveryAddress,
    currency: 'EGP',
    total: formatCents(toCents(order.total.toString())),
    createdAt: order.createdAt.toISOString(),
    lines: order.lines.map((line) => ({
      id: line.id,
      productName: line.productName,
      variantName: line.variantName,
      variantAttributes: line.variantAttributes,
      basePrice: line.basePrice ? formatCents(toCents(line.basePrice.toString())) : null,
      modifierTotal: line.modifierTotal
        ? formatCents(toCents(line.modifierTotal.toString()))
        : null,
      quantity: line.quantity,
      unitPrice: formatCents(toCents(line.unitPrice.toString())),
      lineTotal: formatCents(toCents(line.lineTotal.toString())),
      ...(line.note !== undefined ? { note: line.note } : {}),
      ...(line.kitchenReadyAt !== undefined
        ? { kitchenReadyAt: line.kitchenReadyAt?.toISOString() ?? null }
        : {}),
      selections: line.selections.map((selection) => ({
        groupName: selection.groupName,
        optionName: selection.optionName,
        modifierGroupId: selection.modifierGroupId,
        modifierOptionId: selection.modifierOptionId,
        quantity: selection.quantity ?? 1,
        priceAdjustment: formatCents(toCents(selection.priceAdjustment.toString())),
      })),
    })),
  };
}
