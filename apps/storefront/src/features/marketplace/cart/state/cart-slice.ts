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
  clearCartIfMatches: (snapshot: MarketplaceCartLine[]) => void;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  cart: MarketplaceCartLine[];
  addToCart: (productId: string, quantity?: number, selection?: MealSelection, replace?: boolean, snapshot?: MarketplaceProduct, quotedUnitPrice?: number) => boolean;
  setCartQuantity: (lineId: string, quantity: number) => void;
  removeCartItem: (lineId: string) => void;
  updateCartItem: (lineId: string, selection: MealSelection, quantity: number, quotedUnitPrice?: number) => boolean;
}

export const createCartSlice: StateCreator<MarketplaceState, [], [], CartSlice> = (set, get) => ({
  clearCartIfMatches: (snapshot) => { if (JSON.stringify(get().cart) === JSON.stringify(snapshot)) set({ cart: [], cartOpen: false }); },
  cartOpen: false,
  setCartOpen: (cartOpen) => set({ cartOpen }),
  cart: [],
  updateCartItem: (id, selection, quantity, quotedUnitPrice) => {
    const cart = get().cart;
    const current = cart.find((line) => cartLineId(line) === id);
    const product = current && (current.snapshot ?? findProduct(current.productId));
    if (!current || !product || product.merchantType !== 'restaurant' ||
      !mealAvailable(product) || !validQuantity(quantity) || !validMealSelection(selection, product)) return false;
    if (product.restaurantSlug && (quotedUnitPrice === undefined ||
      !Number.isFinite(quotedUnitPrice) || quotedUnitPrice < 0)) return false;
    const updated: MarketplaceCartLine = {
      productId: current.productId,
      quantity,
      selection: Object.fromEntries(Object.entries(selection).map(([key, ids]) => [key, [...ids]])),
      ...(current.snapshot ? { snapshot: current.snapshot } : {}),
      ...(product.restaurantSlug ? { quotedUnitPrice: quotedUnitPrice! } : {}),
    };
    const nextId = cartLineId(updated);
    const matching = cart.find((line) => cartLineId(line) !== id && cartLineId(line) === nextId);
    updated.quantity += matching?.quantity ?? 0;
    if (!validQuantity(updated.quantity)) return false;
    set({ cart: cart.flatMap((line) => cartLineId(line) === id ? [updated]
      : cartLineId(line) === nextId ? [] : [line]) });
    return true;
  },
  addToCart: (productId, quantity = 1, selection, replace = false, snapshot, quotedUnitPrice) => {
    const product = snapshot ?? findProduct(productId);
    if (!product || !validQuantity(quantity) || !mealAvailable(product)) return false;
    if (product.merchantType === 'restaurant' && !validMealSelection(selection ?? {}, product)) return false;
    if (product.merchantType !== 'restaurant' && selection && Object.keys(selection).length) return false;
    const conflict = conflictsWithRestaurant(get().cart, productId, snapshot);
    if (conflict && !replace) return false;
    const cart = conflict ? [] : get().cart;
    const line: MarketplaceCartLine = { productId, quantity, ...(snapshot ? { snapshot, ...(quotedUnitPrice !== undefined ? { quotedUnitPrice } : {}) } : {}),
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
