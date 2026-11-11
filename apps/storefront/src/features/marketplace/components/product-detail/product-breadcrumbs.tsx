import Link from 'next/link';
import { marketplaceCategories } from '../../search/search-state';
import { marketplaceSearchHref } from '../../search/search-state';
import type { MarketplaceProduct } from '../../model/catalog';

export function ProductBreadcrumbs({
  product,
  backHref,
}: {
  product: MarketplaceProduct;
  backHref: string;
}) {
  const category = marketplaceCategories.find((item) => item.id === product.category);
  const categoryHref = marketplaceSearchHref('/marketplace', '', {
    category: category?.id ?? 'all',
    term: '',
  });
  return (
    <nav className="detail-breadcrumbs" aria-label="مسار التنقل">
      <ol>
        <li>
          <Link href="/marketplace">الرئيسية</Link>
        </li>
        <li>
          <span aria-hidden="true">/</span>
          <Link href={categoryHref}>{category?.name ?? 'المنتجات'}</Link>
        </li>
        <li aria-current="page">
          <span aria-hidden="true">/</span>
          <span>{product.cartName}</span>
        </li>
      </ol>
      <Link href={backHref} className="detail-return">
        العودة للنتائج ←
      </Link>
    </nav>
  );
}
