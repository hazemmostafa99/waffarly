import type { StateCreator } from 'zustand/vanilla';
import type { MarketplaceProduct } from '@/features/marketplace/catalog/model/catalog';
import { findProduct } from '@/features/marketplace/catalog/model/catalog';
import { MAX_CART_QUANTITY, validQuantity, cartLineId, type MarketplaceCartLine } from '@/features/marketplace/cart/model/cart';
import { mealAvailable, validMealSelection, type MealSelection } from '@/features/marketplace/restaurants/model/meal-options';
import type { MarketplaceState } from '@/features/marketplace/state/marketplace-state';

export function conflictsWithRestaurant(cart: MarketplaceCartLine[], productId: string, snapshot?: MarketplaceProduct) {
  const incoming = snapshot ?? findProduct(productId);
  if (!incoming) return false;
  return cart.some((line) => {
    const existing = line.snapshot ?? findProduct(line.productId);
    return existing && (incoming.merchantType === 'restaurant' || existing.merchantType === 'restaurant') &&
      (existing.merchantType !== incoming.merchantType || (existing.restaurantSlug ?? existing.merchantName) !== (incoming.restaurantSlug ?? incoming.merchantName));
  });
}

export interface CartSlice {
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  cart: MarketplaceCartLine[];
  addToCart: (productId: string, quantity?: number, selection?: MealSelection, replace?: boolean, snapshot?: MarketplaceProduct, quotedUnitPrice?: number) => boolean;
  setCartQuantity: (lineId: string, quantity: number) => void;
  removeCartItem: (lineId: string) => void;
}

export const createCartSlice: StateCreator<MarketplaceState, [], [], CartSlice> = (set, get) => ({
  cartOpen: false,
  setCartOpen: (cartOpen) => set({ cartOpen }),
  cart: [],
  addToCart: (productId, quantity = 1, selection, replace = false, snapshot, quotedUnitPrice) => {
    const product = snapshot ?? findProduct(productId);
    if (!product || !validQuantity(quantity) || !mealAvailable(product)) return false;
    if (product.merchantType === 'restaurant' && !validMealSelection(selection ?? {}, product)) return false;
    if (product.merchantType !== 'restaurant' && selection && Object.keys(selection).length) return false;
    const conflict = conflictsWithRestaurant(get().cart, productId, snapshot);
    if (conflict && !replace) return false;
    const cart = conflict ? [] : get().cart;
    const line: MarketplaceCartLine = { productId, quantity, ...(snapshot ? { snapshot, quotedUnitPrice } : {}),
      ...(selection ? { selection: Object.fromEntries(Object.entries(selection).map(([key, ids]) => [key, [...ids]])) } : {}) };
    const id = cartLineId(line);
    const existing = cart.find((item) => cartLineId(item) === id);
    if ((existing?.quantity ?? 0) + quantity > MAX_CART_QUANTITY) return false;
    set({ cart: existing ? cart.map((item) => cartLineId(item) === id
      ? { ...item, quantity: item.quantity + quantity } : item) : [...cart, line] });
    return true;
  },
  setCartQuantity: (id, quantity) => {
    if (!validQuantity(quantity)) return;
    set((state) => ({ cart: state.cart.map((line) => cartLineId(line) === id ? { ...line, quantity } : line) }));
  },
  removeCartItem: (id) => set((state) => ({ cart: state.cart.filter((line) => cartLineId(line) !== id) })),
});
