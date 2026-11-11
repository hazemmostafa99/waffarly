import type { StateCreator } from 'zustand/vanilla';
import {
  demoOrderTrackingSteps,
  type DemoOrder,
} from '@/features/marketplace/orders/model/demo-order';
import type { MarketplaceState } from '@/features/marketplace/state/marketplace-state';

export interface OrdersSlice {
  orders: DemoOrder[];
  advanceDemoOrderStatus: (orderId: string) => void;
}

export const createOrdersSlice: StateCreator<MarketplaceState, [], [], OrdersSlice> = (set) => ({
  orders: [],
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
