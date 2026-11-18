import type { CustomerOrderView } from '@waffarly/contracts';
export const orderStatus = {
  pending: {
    label: 'بانتظار القبول',
    description: 'طلبك وصل للمطعم، وفي انتظار مراجعته وقبوله.',
    tone: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  accepted: {
    label: 'تم قبول الطلب',
    description: 'المطعم قبل طلبك. التجهيز هيبدأ في الخطوة التالية.',
    tone: 'border-blue-200 bg-blue-50 text-blue-800',
  },
  preparing: {
    label: 'جارٍ التحضير',
    description: 'المطعم بيجهّز أصناف طلبك دلوقتي.',
    tone: 'border-purple-200 bg-purple-50 text-purple-800',
  },
  ready: {
    label: 'الطلب جاهز',
    description: 'المطعم علّم طلبك كجاهز. راجع طريقة الاستلام الموضّحة في الطلب.',
    tone: 'border-teal-200 bg-teal-50 text-teal-800',
  },
  completed: {
    label: 'تم التسليم',
    description: 'تم تسجيل تسليم الطلب بواسطة المطعم.',
    tone: 'border-green-200 bg-green-50 text-green-800',
  },
  rejected: {
    label: 'تم رفض الطلب',
    description: 'المطعم لم يقبل الطلب. يمكنك اختيار طلب آخر من المطاعم.',
    tone: 'border-red-200 bg-red-50 text-red-800',
  },
  cancelled: {
    label: 'الطلب ملغي',
    description: 'تم إلغاء الطلب. حالة الطلب وحدها لا تؤكد رد أي مبلغ سبق تحصيله.',
    tone: 'border-red-200 bg-red-50 text-red-800',
  },
} satisfies Record<
  CustomerOrderView['status'],
  { label: string; description: string; tone: string }
>;
export const isFinishedOrder = (status: CustomerOrderView['status']) =>
  ['completed', 'rejected', 'cancelled'].includes(status);
export const shortOrderId = (id: string) => id.slice(0, 8).toUpperCase();
export function orderDate(value: string) {
  const date = new Date(value);
  return {
    date: new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date),
    time: new Intl.DateTimeFormat('ar-EG-u-nu-latn', { hour: 'numeric', minute: '2-digit' }).format(
      date,
    ),
  };
}
export const fulfillmentLabel = (order: Pick<CustomerOrderView, 'fulfillmentType'>) =>
  order.fulfillmentType === 'pickup' ? 'استلام من المطعم' : 'توصيل';
