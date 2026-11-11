import type { CheckoutItem, Fulfillment } from '@/features/marketplace/checkout/model/checkout';

export type DemoOrderStatus = 'demo-confirmed';

/** A transient, product-only order snapshot. Contact details are never recorded here. */
export interface DemoOrder {
  id: string;
  createdAt: string;
  status: DemoOrderStatus;
  fulfillment: Fulfillment;
  items: CheckoutItem[];
}

export function demoOrderTotal(order: Pick<DemoOrder, 'items'>) {
  return order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function formatDemoOrderDate(value: string) {
  return new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
