import type { DemoOrderStatus } from '@/features/marketplace/orders/model/demo-order';

export function OrderStatusBadge({ status }: { status: DemoOrderStatus }) {
  return (
    <span className="inline-flex w-fit items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-[12px] font-bold text-accent">
      <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
      {status === 'demo-confirmed' ? 'تم التأكيد — تجربة محلية' : 'حالة تجريبية'}
    </span>
  );
}
