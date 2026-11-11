import { cn } from '@waffarly/ui';
import { MarketplaceCard as Card } from '@/components/marketplace/marketplace-card';
import Link from 'next/link';

export function CartEmptyState() {
  return (
    <Card
      className={cn(
        'cart-empty-state bg-card border border-solid border-border rounded-[20px] py-16 px-6',
        'text-center [&_h2]:text-[24px] [&_h2]:mt-0 [&_h2]:mx-0 [&_h2]:mb-3 [&_p]:text-[14px] [&_p]:text-muted-foreground [&_p]:leading-[1.8]',
        '[&_p]:mt-0 [&_p]:mx-0 [&_p]:mb-6 [&_a]:inline-block [&_a]:no-underline',
      )}
      aria-labelledby="empty-cart-title"
    >
      <span
        className={cn(
          'cart-empty-icon grid place-items-center w-19 h-19 mt-0 mx-auto mb-5',
          'bg-secondary rounded-[24px] text-[32px]',
        )}
        aria-hidden="true"
      >
        🛒
      </span>
      <h2 id="empty-cart-title">سلتك لسه فاضية</h2>
      <p>تصفّح المنتجات وأضف اللي يعجبك، وهتلاقيه هنا جاهز للمراجعة.</p>
      <Link
        href="/marketplace#deals"
        className={
          'btn btn-gold border-0 rounded-[11px] py-[13px] px-5 font-extrabold bg-waffarly-gold text-[#2d1038]'
        }
      >
        ابدأ التسوق
      </Link>
    </Card>
  );
}
