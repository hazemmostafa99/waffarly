import Link from 'next/link';
import { Heart } from 'lucide-react';
import { MarketplaceCard as Card } from '@/components/marketplace/marketplace-card';

export function FavoritesEmptyState() {
  return (
    <Card className="flex flex-col items-center rounded-xl bg-card px-4 py-7 text-center">
      <span
        className="mx-auto mb-3 grid size-11 place-items-center rounded-xl bg-secondary text-accent"
        aria-hidden="true"
      >
        <Heart size={22} strokeWidth={1.6} />
      </span>
      <h2 className="mb-1 mt-0 text-[17px] font-bold text-primary">المفضلة فاضية</h2>
      <p className="mb-4 mt-0 text-[12px] leading-6 text-muted-foreground">
        اضغط القلب على أي صنف عشان تحفظه هنا.
      </p>
      <Link
        href="/#deals"
        className="inline-flex min-h-10 items-center rounded-lg bg-waffarly-gold px-4 py-2 text-[13px] font-medium text-[#2d1038] no-underline hover:bg-[#ffd353]"
      >
        تصفح المنتجات
      </Link>
    </Card>
  );
}
