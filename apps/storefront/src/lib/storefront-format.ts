import type { Locale } from '@waffarly/ui';
import type { PublicStorefrontProduct } from '@waffarly/contracts';

export function formatStorefrontPrice(value: string | number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-EG-u-nu-latn', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function toMinorUnits(value: string): number {
  const [whole = '0', fraction = ''] = value.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2));
}

export function fromMinorUnits(value: number): string {
  const whole = Math.trunc(value / 100);
  const fraction = Math.abs(value % 100)
    .toString()
    .padStart(2, '0');
  return `${whole}.${fraction}`;
}

export function getProductStartingPrice(product: PublicStorefrontProduct): string {
  const availablePrices = product.variants
    .filter((variant) => variant.availability === 'available')
    .map((variant) => Number(variant.price));
  if (availablePrices.length === 0) return product.basePrice;
  return String(Math.min(...availablePrices));
}
