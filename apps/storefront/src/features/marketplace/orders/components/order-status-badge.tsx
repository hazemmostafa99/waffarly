import type { DemoOrderStatus } from '@/features/marketplace/orders/model/demo-order';

export function OrderStatusBadge({ status }: { status: DemoOrderStatus }) {
  const labelByStatus: Record<DemoOrderStatus, string> = {
    'demo-confirmed': 'تم التأكيد — تجربة محلية',
    'demo-preparing': 'قيد التجهيز — محاكاة',
    'demo-in-transit': 'في الطريق — محاكاة',
    'demo-ready-for-pickup': 'جاهز للاستلام — محاكاة',
    'demo-completed': 'اكتمل العرض التجريبي',
    'demo-cancelled': 'تم الإلغاء — تجربة محلية',
    'demo-rejected': 'رفض المطعم — تجربة محلية',
  };

  return (
    <span className="inline-flex w-fit items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-[12px] font-bold text-accent">
      <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
      {labelByStatus[status]}
    </span>
  );
}
