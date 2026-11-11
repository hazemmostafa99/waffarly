import { findProduct } from '@/features/marketplace/catalog/model/catalog';

export interface MarketplaceCartLine {
  productId: string;
  quantity: number;
}
export const MAX_CART_QUANTITY = 99; // Local UI limit, not verified stock.
export function validQuantity(quantity: number) {
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX_CART_QUANTITY;
}
export function cartProducts(lines: MarketplaceCartLine[]) {
  return lines.flatMap((line) => {
    const product = findProduct(line.productId);
    return product ? [{ ...product, quantity: line.quantity }] : [];
  });
}
export function cartTotal(lines: MarketplaceCartLine[]) {
  return cartProducts(lines).reduce((sum, product) => sum + product.price * product.quantity, 0);
}
export function cartQuantity(lines: MarketplaceCartLine[]) {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}
