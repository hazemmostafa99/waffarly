import Link from 'next/link';
import { MarketplaceCard as Card } from '@/components/marketplace/marketplace-card';

export function OrdersEmptyState() {
  return (
    <Card className="rounded-[20px] border border-solid border-border bg-card px-6 py-16 text-center">
      <span
        className="mx-auto mb-5 grid size-19 place-items-center rounded-[24px] bg-secondary text-[32px]"
        aria-hidden="true"
      >
        📦
      </span>
      <h2 className="mb-3 mt-0 text-2xl">لسه مفيش طلبات في الجلسة دي</h2>
      <p className="mb-6 mt-0 leading-[1.8] text-muted-foreground">
        الطلبات التجريبية بتظهر هنا بعد إكمال الـCheckout، وبتتمسح لما تحدّث الصفحة.
      </p>
      <Link
        href="/"
        className="inline-block rounded-[11px] bg-waffarly-gold px-5 py-[13px] font-extrabold text-[#2d1038] no-underline"
      >
        ابدأ التسوق
      </Link>
    </Card>
  );
}
