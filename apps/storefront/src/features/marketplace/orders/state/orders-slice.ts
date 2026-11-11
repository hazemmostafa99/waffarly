import type { StateCreator } from 'zustand/vanilla';
import type { DemoOrder } from '@/features/marketplace/orders/model/demo-order';
import type { MarketplaceState } from '@/features/marketplace/state/marketplace-state';

export interface OrdersSlice {
  orders: DemoOrder[];
}

export const createOrdersSlice: StateCreator<MarketplaceState, [], [], OrdersSlice> = () => ({
  orders: [],
});
