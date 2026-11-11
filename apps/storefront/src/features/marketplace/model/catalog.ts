import data from '../data/reference.json';

export type MarketplaceProduct = (typeof data.products)[number];
export interface MarketplaceCartLine {
  productId: string;
  quantity: number;
}
export const MAX_CART_QUANTITY = 99; // Local UI limit, not verified stock.
export function findProduct(id: string) {
  return data.products.find((product) => product.id === id);
}
export function validQuantity(quantity: number) {
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX_CART_QUANTITY;
}
export function filterProducts(category: string, term: string) {
  return data.products.filter(
    (p) => (category === 'all' || p.category === category) && p.searchName.includes(term.trim()),
  );
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
const priceFormatter = new Intl.NumberFormat('en-US', { numberingSystem: 'latn' });
export const money = (value: number) => priceFormatter.format(value) + ' ج.م';
