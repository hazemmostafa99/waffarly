import type { StateCreator } from 'zustand/vanilla';
import {
  demoOrderTrackingSteps,
  type DemoOrder,
} from '@/features/marketplace/orders/model/demo-order';
import type { MarketplaceState } from '@/features/marketplace/state/marketplace-state';
import { reorderCart, type ReorderResult } from '@/features/marketplace/orders/model/reorder';

export interface OrdersSlice {
  orders: DemoOrder[];
  advanceDemoOrderStatus: (orderId: string) => void;
  stopDemoOrder: (orderId: string, reason: 'demo-cancelled' | 'demo-rejected') => void;
  reorderDemoOrder: (orderId: string, replace?: boolean) => ReorderResult;
}

export const createOrdersSlice: StateCreator<MarketplaceState, [], [], OrdersSlice> = (
  set,
  get,
) => ({
  orders: [],
  reorderDemoOrder: (id, replace = false) => {
    const order = get().orders.find((entry) => entry.id === id);
    if (!order) return 'unavailable';
    const next = reorderCart(order, get().cart, replace);
    if (next.cart) set({ cart: next.cart });
    return next.result;
  },
  stopDemoOrder: (orderId, reason) =>
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id === orderId &&
        order.restaurantName &&
        (order.status === 'demo-confirmed' || order.status === 'demo-preparing')
          ? { ...order, status: reason }
          : order,
      ),
    })),
  advanceDemoOrderStatus: (orderId) =>
    set((state) => ({
      orders: state.orders.map((order) => {
        if (order.id !== orderId) return order;

        const steps = demoOrderTrackingSteps(order.fulfillment);
        const currentIndex = steps.findIndex((step) => step.status === order.status);
        const nextStep = currentIndex >= 0 ? steps[currentIndex + 1] : undefined;
        return nextStep ? { ...order, status: nextStep.status } : order;
      }),
    })),
});
