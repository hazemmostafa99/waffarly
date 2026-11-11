import Link from 'next/link';
import {
  productListingHref,
  type ProductListingState,
} from '@/features/marketplace/catalog/model/product-listing';

export function ProductListingPagination({
  pathname,
  paramsString,
  state,
  page,
}: {
  pathname: string;
  paramsString: string;
  state: ProductListingState;
  page: { page: number; pageCount: number };
}) {
  if (page.pageCount <= 1) return null;

  return (
    <nav
      aria-label="صفحات النتائج"
      className="mt-6 flex flex-wrap items-center justify-center gap-2"
    >
      {page.page > 1 && (
        <Link
          href={productListingHref(pathname, paramsString, { ...state, page: page.page - 1 })}
          className="rounded-lg border border-border bg-white px-3 py-2 text-xs font-bold text-primary no-underline hover:border-accent"
        >
          السابق
        </Link>
      )}
      {Array.from({ length: page.pageCount }, (_, index) => index + 1).map((pageNumber) => (
        <Link
          key={pageNumber}
          href={productListingHref(pathname, paramsString, { ...state, page: pageNumber })}
          aria-current={pageNumber === page.page ? 'page' : undefined}
          className={
            'grid size-9 place-items-center rounded-lg border text-xs font-bold no-underline ' +
            (pageNumber === page.page
              ? 'border-primary bg-primary text-white'
              : 'border-border bg-white text-primary hover:border-accent')
          }
        >
          {pageNumber}
        </Link>
      ))}
      {page.page < page.pageCount && (
        <Link
          href={productListingHref(pathname, paramsString, { ...state, page: page.page + 1 })}
          className="rounded-lg border border-border bg-white px-3 py-2 text-xs font-bold text-primary no-underline hover:border-accent"
        >
          التالي
        </Link>
      )}
    </nav>
  );
}
