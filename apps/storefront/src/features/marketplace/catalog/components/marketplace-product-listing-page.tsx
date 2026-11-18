'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { ProductCard } from '@/features/marketplace/catalog/components/product-card';
import { ProductListingFilters } from '@/features/marketplace/catalog/components/product-listing-filters';
import { ProductListingPagination } from '@/features/marketplace/catalog/components/product-listing-pagination';
import { MarketplaceSiteHeader } from '@/features/marketplace/navigation/components/marketplace-site-header';
import { MarketplaceFooter } from '@/features/marketplace/navigation/components/marketplace-footer';
import {
  filterAndSortProducts,
  paginateProducts,
  parseProductListingState,
  productListingHref,
  type ProductListingState,
} from '@/features/marketplace/catalog/model/product-listing';
import data from '@/features/marketplace/data/reference.json';

export type ProductListingMode = 'all' | 'offers';

const pageCopy = {
  all: {
    title: 'كل المنتجات',
    searchLabel: 'ابحث في المنتجات',
    eyebrow: 'منتجات السوق',
    description:
      'تصفّح المنتجات المتاحة في بيانات السوق المحلية، وابحث أو رتّب النتائج حسب احتياجك.',
    countLabel: 'منتجات',
    empty: 'مفيش منتجات مطابقة للاختيارات دي.',
    pathname: '/products',
  },
  offers: {
    title: 'كل العروض',
    searchLabel: 'ابحث في العروض',
    eyebrow: 'وفّر على اختياراتك',
    description: 'تصفّح المنتجات المخفّضة وابحث داخل العروض المتاحة في البيانات المحلية.',
    countLabel: 'عروض',
    empty: 'مفيش عروض مطابقة للاختيارات دي.',
    pathname: '/offers',
  },
} satisfies Record<
  ProductListingMode,
  {
    title: string;
    searchLabel: string;
    eyebrow: string;
    description: string;
    countLabel: string;
    empty: string;
    pathname: string;
  }
>;

export function MarketplaceProductListingPage({ mode }: { mode: ProductListingMode }) {
  const router = useRouter();
  const pathname = usePathname() ?? pageCopy[mode].pathname;
  const searchParams = useSearchParams();
  const paramsString = searchParams.toString();
  const state = parseProductListingState(searchParams);
  const copy = pageCopy[mode];
  const [draftTerm, setDraftTerm] = useState(state.term);
  const products =
    mode === 'offers'
      ? data.products.filter((product) => Boolean(product.oldPrice?.trim()))
      : data.products;
  const filteredProducts = filterAndSortProducts(products, state);
  const page = paginateProducts(filteredProducts, state.page);

  useEffect(() => setDraftTerm(state.term), [state.term]);

  function navigate(next: Partial<ProductListingState>) {
    const url = productListingHref(pathname, paramsString, {
      category: next.category ?? state.category,
      term: next.term ?? state.term,
      sort: next.sort ?? state.sort,
      page: next.page ?? 1,
    });
    if (window.location.pathname + window.location.search !== url) {
      router.push(url, { scroll: false });
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({ term: draftTerm.trim(), page: 1 });
  }

  const hasFilters =
    state.category !== 'all' ||
    Boolean(state.term) ||
    state.sort !== 'recommended' ||
    state.page > 1;

  return (
    <>
      <MarketplaceSiteHeader />
      <main id="marketplace-main" tabIndex={-1} className="pb-20">
        <MarketplaceContainer>
          <nav
            aria-label="مسار التنقل"
            className="mb-3 mt-5 flex items-center gap-2 text-xs text-muted-foreground"
          >
            <Link className="text-accent no-underline hover:text-primary" href="/">
              الرئيسية
            </Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{copy.title}</span>
          </nav>
          <h1 className="sr-only">{copy.title}</h1>
          <header className="mb-4 mt-0">
            <p className="mb-1 text-xs font-bold text-accent">{copy.eyebrow}</p>
            <p className="mb-0 mt-0.5 text-sm text-muted-foreground">{copy.description}</p>
          </header>

          <ProductListingFilters
            state={state}
            draftTerm={draftTerm}
            searchLabel={copy.searchLabel}
            onSearch={submitSearch}
            onDraftTermChange={setDraftTerm}
            onCategoryChange={(category) => navigate({ category, page: 1 })}
            onSortChange={(sort) => navigate({ sort, page: 1 })}
          />

          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="m-0 text-xs text-muted-foreground" aria-live="polite">
              {page.total > 0
                ? 'عرض ' + page.from + '–' + page.to + ' من ' + page.total + ' ' + copy.countLabel
                : '0 ' + copy.countLabel}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setDraftTerm('');
                  navigate({ category: 'all', term: '', sort: 'recommended', page: 1 });
                }}
                className="border-0 bg-transparent p-1 text-xs font-bold text-accent underline-offset-4 hover:underline"
              >
                مسح التصفية
              </button>
            )}
          </div>

          {page.total > 0 ? (
            <>
              <div className="grid grid-cols-4 gap-3 max-[1100px]:grid-cols-3 max-[700px]:flex max-[700px]:overflow-x-auto max-[700px]:[scroll-snap-type:x_mandatory] max-[700px]:pb-2">
                {page.items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              <ProductListingPagination
                pathname={pathname}
                paramsString={paramsString}
                state={state}
                page={page}
              />
            </>
          ) : (
            <p className="rounded-2xl border border-border bg-white p-8 text-center text-sm text-muted-foreground">
              {copy.empty} جرّب تغيير كلمة البحث أو اختيار قسم تاني.
            </p>
          )}
        </MarketplaceContainer>
      </main>
      <MarketplaceFooter />
    </>
  );
}
