import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import type {
  CreatePosOrderResponse,
  PosEmployeeSession,
  PosOrderQuoteRequest,
  PosOrderQuoteResponse,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';

import { formatCents, toCents } from '../../../common/money/money.js';

import { ProductPricingService } from '../../catalog/index.js';

const MAX_ORDER_TOTAL_CENTS = 999_999_999_999n;

export async function quotePosSaleItems(
  pricing: ProductPricingService,

  merchantId: string,
  request: PosOrderQuoteRequest,
  transaction?: Prisma.TransactionClient,
): Promise<PosOrderQuoteResponse> {
  const items: PosOrderQuoteResponse['items'] = [];
  let totalCents = 0n;
  for (const item of request.items) {
    const quote = await pricing.quoteForMerchant(
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
export function requirePosSellPermission(employee: PosEmployeeSession): void {
  if (!employee.permissions.includes('sell'))
    throw new ForbiddenException('This employee is not authorized to sell.');
}
export function replayPosSale(
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
export function quoteSelectionsForRequirements(
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

export function createSelectionSnapshots(
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
