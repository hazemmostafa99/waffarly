import type { DemoOrder } from './demo-order';
import { findProduct } from '@/features/marketplace/catalog/model/catalog';
import { cartLineId, MAX_CART_QUANTITY, validQuantity, type MarketplaceCartLine } from '@/features/marketplace/cart/model/cart';
import { conflictsWithRestaurant } from '@/features/marketplace/cart/state/cart-slice';
import { mealAvailable, validMealSelection } from '@/features/marketplace/restaurants/model/meal-options';

export type ReorderResult = 'added' | 'conflict' | 'unavailable' | 'limit';

export function reorderCart(order: DemoOrder, current: MarketplaceCartLine[], replace: boolean): { result: ReorderResult; cart?: MarketplaceCartLine[] } {
  const conflict = order.items.some((item) => conflictsWithRestaurant(current, item.id));
  if (conflict && !replace) return { result: 'conflict' };
  let cart = conflict ? [] : current.map((line) => ({ ...line }));
  for (const item of order.items) {
    const product = findProduct(item.id);
    if (!product || !mealAvailable(product) || !validQuantity(item.quantity) ||
      (product.merchantType === 'restaurant' && !validMealSelection(item.selection ?? {}, product))) return { result: 'unavailable' };
    if (conflictsWithRestaurant(cart, item.id)) return { result: 'unavailable' };
    const line: MarketplaceCartLine = { productId: item.id, quantity: item.quantity,
      ...(item.selection ? { selection: Object.fromEntries(Object.entries(item.selection).map(([id, values]) => [id, [...values]])) } : {}) };
    const id = cartLineId(line);
    const existing = cart.find((entry) => cartLineId(entry) === id);
    if ((existing?.quantity ?? 0) + item.quantity > MAX_CART_QUANTITY) return { result: 'limit' };
    cart = existing ? cart.map((entry) => cartLineId(entry) === id ? { ...entry, quantity: entry.quantity + item.quantity } : entry) : [...cart, line];
  }
  return { result: 'added', cart };
}
