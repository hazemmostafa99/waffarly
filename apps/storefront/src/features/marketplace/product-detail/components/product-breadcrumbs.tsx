import { cn } from '@waffarly/ui';
import Link from 'next/link';
import { marketplaceCategories } from '@/features/marketplace/search/model/search-state';
import { marketplaceSearchHref } from '@/features/marketplace/search/model/search-state';
import { type MarketplaceProduct } from '@/features/marketplace/catalog/model/catalog';

export function ProductBreadcrumbs({
  product,
  backHref,
}: {
  product: MarketplaceProduct;
  backHref: string;
}) {
  const category = marketplaceCategories.find((item) => item.id === product.category);
  const restaurant = product.merchantType === 'restaurant';
  const menuHref = `/restaurants/${encodeURIComponent(product.restaurantSlug ?? product.merchantName ?? product.seller)}`;
  const categoryHref = restaurant ? '/restaurants' : marketplaceSearchHref('/', '', {
    category: category?.id ?? 'all',
    term: '',
  });
  return (
    <nav
      className={cn(
        'detail-breadcrumbs flex items-center justify-between gap-4 max-w-310 my-5 mx-auto',
        'text-[12px] text-muted-foreground [&_ol]:flex [&_ol]:items-center [&_ol]:flex-wrap [&_ol]:gap-2.5 [&_ol]:list-none [&_ol]:p-0',
        '[&_ol]:m-0 [&_ol]:min-w-0 [&_li]:flex [&_li]:items-center [&_li]:gap-2.5 [&_a]:text-accent [&_a]:no-underline [&_a:hover]:underline',
        'max-[700px]:items-start max-[700px]:text-[11px] max-[700px]:my-4',
        restaurant && 'max-w-[1480px] text-[11px]',
      )}
      aria-label="مسار التنقل"
    >
      <ol>
        <li>
          <Link href="/">الرئيسية</Link>
        </li>
        <li>
          <span aria-hidden="true">/</span>
          <Link href={categoryHref}>{restaurant ? 'المطاعم' : category?.name ?? 'المنتجات'}</Link>
        </li>
        <li aria-current="page">
          <span aria-hidden="true">/</span>
          <span>{product.cartName}</span>
        </li>
      </ol>
      <Link href={restaurant ? menuHref : backHref} className={'detail-return whitespace-nowrap max-[700px]:hidden'}>
        {restaurant ? 'العودة إلى قائمة المطعم ←' : 'العودة للنتائج ←'}
      </Link>
    </nav>
  );
}
