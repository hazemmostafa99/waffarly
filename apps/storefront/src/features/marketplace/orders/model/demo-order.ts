import type { CheckoutItem, Fulfillment } from '@/features/marketplace/checkout/model/checkout';

export type DemoOrderStatus =
  | 'demo-confirmed'
  | 'demo-preparing'
  | 'demo-in-transit'
  | 'demo-ready-for-pickup'
  | 'demo-completed';

export interface DemoOrderTrackingStep {
  status: DemoOrderStatus;
  label: string;
  description: string;
}

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

export function demoOrderTrackingSteps(
  fulfillment: Fulfillment,
): DemoOrderTrackingStep[] {
  return [
    {
      status: 'demo-confirmed',
      label: 'تم التأكيد التجريبي',
      description: 'بدأ سيناريو متابعة الطلب داخل هذه الجلسة.',
    },
    {
      status: 'demo-preparing',
      label: 'تجهيز الطلب',
      description: 'خطوة توضيحية ضمن محاكاة رحلة الطلب.',
    },
    fulfillment === 'delivery'
      ? {
          status: 'demo-in-transit',
          label: 'الطلب في الطريق',
          description: 'حالة توصيل تمثيلية، من غير شحنة أو مندوب فعلي.',
        }
      : {
          status: 'demo-ready-for-pickup',
          label: 'الطلب جاهز للاستلام',
          description: 'حالة استلام تمثيلية، من غير فرع أو استلام فعلي.',
        },
    {
      status: 'demo-completed',
      label: 'اكتمل العرض التجريبي',
      description: 'انتهت خطوات المحاكاة فقط؛ لم يتم تسليم أو استلام منتجات.',
    },
  ];
}

export function formatDemoOrderDate(value: string) {
  return new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
