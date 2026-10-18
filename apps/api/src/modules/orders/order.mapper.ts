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
  branchId?: string | null;
  warehouseId?: string | null;
  branchName?: string | null;
  warehouseName?: string | null;
  acceptedAt?: Date | null;
  preparationStartedAt?: Date | null;
  cancelledAt?: Date | null;
  cancellationReason?: string | null;
  stockRestored?: boolean | null;
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
