import type { MarketplaceProduct } from '@/features/marketplace/catalog/model/catalog';
import { findProduct } from '@/features/marketplace/catalog/model/catalog';
import { mealConfiguration, type MealSelection } from '@/features/marketplace/restaurants/model/meal-options';

export interface MarketplaceCartLine {
  productId: string;
  quantity: number;
  selection?: MealSelection;
  snapshot?: MarketplaceProduct;
  quotedUnitPrice?: number;
}
export function cartLineId(line: Pick<MarketplaceCartLine, 'productId' | 'selection'>) {
  const options = Object.entries(line.selection ?? {}).filter(([, ids]) => ids.length)
    .sort(([a], [b]) => a.localeCompare(b)).map(([id, ids]) => `${id}:${[...ids].sort().join(',')}`).join('|');
  return options ? `${line.productId}::${options}` : line.productId;
}
export const MAX_CART_QUANTITY = 99; // Local UI limit, not verified stock.
export function validQuantity(quantity: number) {
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX_CART_QUANTITY;
}
export function cartProducts(lines: MarketplaceCartLine[]) {
  return lines.flatMap((line) => {
    const product = line.snapshot ?? findProduct(line.productId);
    const configuration = mealConfiguration(line.selection ?? {}, product);
    return product ? [{ ...product, price: line.quotedUnitPrice ?? product.price + configuration.extraPrice,
      quantity: line.quantity, selection: line.selection, lineId: cartLineId(line),
      optionsLabel: configuration.label }] : [];
  });
}
export function cartTotal(lines: MarketplaceCartLine[]) {
  return cartProducts(lines).reduce((sum, product) => sum + product.price * product.quantity, 0);
}
export function cartQuantity(lines: MarketplaceCartLine[]) {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}
