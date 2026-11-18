import { BadRequestException, ConflictException } from '@nestjs/common';
import type {
  CatalogProductPromotion,
  CatalogProductPromotionFields,
} from '@waffarly/contracts';
import { formatCents, toCents } from '../../../common/money/money.js';

export interface StoredProductPromotion {
  promotionEnabled: boolean;
  promotionType: string | null;
  promotionValue: { toString(): string } | string | null;
  promotionStartsAt: Date | null;
  promotionEndsAt: Date | null;
}

export function toProductPromotion(
  row: StoredProductPromotion,
  now = new Date(),
): CatalogProductPromotion | null {
  if (row.promotionType === null || row.promotionValue === null) return null;
  if (row.promotionType !== 'percentage' && row.promotionType !== 'amount') return null;
  const value = formatCents(toCents(row.promotionValue.toString()));
  const startsAt = row.promotionStartsAt;
  const endsAt = row.promotionEndsAt;
  const status = !row.promotionEnabled
    ? 'paused'
    : startsAt && startsAt > now
      ? 'scheduled'
      : endsAt && endsAt <= now
        ? 'ended'
        : 'active';
  return {
    enabled: row.promotionEnabled,
    type: row.promotionType,
    value,
    startsAt: startsAt?.toISOString() ?? null,
    endsAt: endsAt?.toISOString() ?? null,
    status,
  };
}

export function calculatePromotionalPrice(
  basePrice: string,
  row: StoredProductPromotion,
  now = new Date(),
) {
  const promotion = toProductPromotion(row, now);
  if (!promotion || promotion.status !== 'active')
    return { promotionalPrice: null, appliedPromotion: null };

  const baseCents = toCents(basePrice);
  const valueCents = toCents(promotion.value);
  const discountCents =
    promotion.type === 'amount'
      ? valueCents
      : (baseCents * valueCents + 5_000n) / 10_000n;
  if (discountCents <= 0n || discountCents >= baseCents)
    throw new ConflictException('Promotion must reduce the price and leave a positive product price.');
  return {
    promotionalPrice: formatCents(baseCents - discountCents),
    appliedPromotion: {
      type: promotion.type,
      value: promotion.value,
      discountAmount: formatCents(discountCents),
    },
  };
}

export function assertProductPromotionPrices(
  promotion: CatalogProductPromotionFields | null | undefined,
  basePrice: string,
  variantPrices: readonly string[],
) {
  if (!promotion?.enabled) return;
  if (!promotion.type || !promotion.value) {
    throw new BadRequestException('An enabled promotion needs a discount type and value.');
  }
  const prices = variantPrices.length ? variantPrices : [basePrice];
  for (const price of prices) {
    try {
      calculatePromotionalPrice(price, {
        promotionEnabled: true,
        promotionType: promotion.type,
        promotionValue: promotion.value,
        promotionStartsAt: null,
        promotionEndsAt: null,
      });
    } catch {
      throw new BadRequestException('Promotion must leave a positive price for every variant.');
    }
  }
}

export function productPromotionData(promotion: CatalogProductPromotionFields | null | undefined) {
  const value = promotion?.value?.trim() || null;
  const type = value ? (promotion?.type ?? null) : null;
  return {
    promotionEnabled: Boolean(promotion?.enabled && value && type),
    promotionType: type,
    promotionValue: value,
    promotionStartsAt: value && promotion?.startsAt ? new Date(promotion.startsAt) : null,
    promotionEndsAt: value && promotion?.endsAt ? new Date(promotion.endsAt) : null,
  };
}
