import { cn } from '@waffarly/ui';
import { MarketplaceCard as Card } from '@/components/marketplace/marketplace-card';
import { type MarketplaceProduct } from '@/features/marketplace/catalog/model/catalog';

export function ProductSellerCard({ product }: { product: MarketplaceProduct }) {
  const seller = product.seller.replace('✓', '').trim();
  return (
    <Card
      className={cn(
        'detail-seller-card flex items-center gap-3 p-3.5 border border-solid border-border',
        'rounded-[12px] [&_.seller]:m-0 [&_.seller]:text-[13px] [&_p]:mt-1.5 [&_p]:mx-0 [&_p]:mb-0 [&_small]:block [&_small]:text-muted-foreground',
        '[&_small]:text-[10px] [&_small]:mt-1',
      )}
      aria-label="البائع وبيانات التوصيل"
    >
      <div
        className={cn(
          'detail-seller-icon grid place-items-center w-11 h-11 shrink-0 rounded-[12px] bg-secondary',
          'text-accent text-[22px] [font-weight:bold]',
        )}
        aria-hidden="true"
      >
        {seller.slice(0, 1)}
      </div>
      <div>
        <span className={'detail-section-label block text-[11px] text-muted-foreground mb-[5px]'}>
          {product.origin === 'local-mock' ? 'بائع المثال المحلي' : 'يباع بواسطة'}
        </span>
        <div
          className={
            'seller flex items-center gap-1.5 text-accent text-[10px] font-extrabold mb-[7px]'
          }
        >
          <strong>{seller}</strong>
          {!product.origin && (
            <span
              className={
                'verified bg-accent text-[#fff] rounded-full w-[15px] h-[15px] inline-grid place-items-center text-[9px]'
              }
              aria-label="علامة التحقق في النموذج"
            >
              ✓
            </span>
          )}
        </div>
        <p>
          <span className={'delivery text-success text-[10px] font-extrabold'}>
            {product.delivery}
          </span>
          <small>
            {product.origin === 'local-mock'
              ? 'تفاصيل العرض والتوصيل توضيحية فقط'
              : 'بيانات التوصيل من النموذج المحلي'}
          </small>
        </p>
      </div>
    </Card>
  );
}
