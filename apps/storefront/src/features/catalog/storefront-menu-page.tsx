'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BookOpen, ChevronLeft, Search, SearchX, SlidersHorizontal } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import type { CursorPage, PublicStorefrontCatalog } from '@waffarly/contracts';
import { Input } from '@waffarly/ui';
import { useLocale } from '@waffarly/ui';
import { apiGetBrowser } from '../../lib/api-client';
import { getProductStartingPrice } from '../../lib/storefront-format';
import { storefrontCopy } from '../../lib/storefront-copy';
import { StorefrontProductGrid } from './storefront-product-grid';

type StorefrontMenuPageProps = {
  catalog: PublicStorefrontCatalog;
  initialCategoryId: string;
  initialSearch: string;
  initialSort: string;
};

export function StorefrontMenuPage({
  catalog,
  initialCategoryId,
  initialSearch,
  initialSort,
}: StorefrontMenuPageProps) {
  const { locale } = useLocale();
  const t = storefrontCopy(locale);
  const router = useRouter();
  const pathname = usePathname();
  const [loadedCatalog, setLoadedCatalog] = useState(catalog);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [search, setSearch] = useState(initialSearch);
  const sort = initialSort === 'price-asc' || initialSort === 'price-desc' ? initialSort : 'default';
  const sortLabel = sort === 'price-asc'
    ? t.priceAscending
    : sort === 'price-desc'
      ? t.priceDescending
      : t.sort;

  useEffect(() => setSearch(initialSearch), [initialSearch]);
  useEffect(() => setLoadedCatalog(catalog), [catalog.slug]);

  async function loadMore() {
    if (loadingMore || (!loadedCatalog.nextProductCursor && !loadedCatalog.nextCategoryCursor)) return;
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const productPageRequest = loadedCatalog.nextProductCursor
        ? apiGetBrowser<CursorPage<PublicStorefrontCatalog['products'][number]>>(
            `catalog/stores/${encodeURIComponent(catalog.slug)}/products?cursor=${encodeURIComponent(loadedCatalog.nextProductCursor)}`,
          )
        : Promise.resolve<CursorPage<PublicStorefrontCatalog['products'][number]>>({
            items: [],
            nextCursor: null,
          });
      const categoryPageRequest = loadedCatalog.nextCategoryCursor
        ? apiGetBrowser<CursorPage<PublicStorefrontCatalog['categories'][number]>>(
            `catalog/stores/${encodeURIComponent(catalog.slug)}/categories?cursor=${encodeURIComponent(loadedCatalog.nextCategoryCursor)}`,
          )
        : Promise.resolve<CursorPage<PublicStorefrontCatalog['categories'][number]>>({
            items: [],
            nextCursor: null,
          });
      const [productPage, categoryPage] = await Promise.all([productPageRequest, categoryPageRequest]);
      setLoadedCatalog((current) => ({
        ...current,
        categories: appendUnique(current.categories, categoryPage.items),
        products: appendUnique(current.products, productPage.items),
        nextCategoryCursor: categoryPage.nextCursor,
        nextProductCursor: productPage.nextCursor,
      }));
    } catch {
      setLoadMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  function updateUrl(next: { category?: string; q?: string; sort?: string }) {
    const params = new URLSearchParams();
    const category = next.category ?? initialCategoryId;
    const query = next.q ?? initialSearch;
    const nextSort = next.sort ?? sort;
    if (category) params.set('category', category);
    if (query.trim()) params.set('q', query.trim());
    if (nextSort !== 'default') params.set('sort', nextSort);
    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateUrl({ q: search });
  }

  const normalizedSearch = initialSearch.trim().toLocaleLowerCase(locale === 'ar' ? 'ar-EG' : 'en-EG');
  const filteredProducts = loadedCatalog.products
    .filter((product) => !initialCategoryId || product.categories.some((category) => category.id === initialCategoryId))
    .filter((product) =>
      !normalizedSearch || `${product.name} ${product.description ?? ''} ${product.categories.map((category) => category.name).join(' ')}`
        .toLocaleLowerCase(locale === 'ar' ? 'ar-EG' : 'en-EG')
        .includes(normalizedSearch),
    )
    .sort((left, right) => {
      if (sort === 'default') return 0;
      const difference = Number(getProductStartingPrice(left)) - Number(getProductStartingPrice(right));
      return sort === 'price-asc' ? difference : -difference;
    });
  const number = filteredProducts.length.toLocaleString(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-EG-u-nu-latn');
  const categoryImages = loadedCatalog.categories.map((category) => {
    const matchingProduct = loadedCatalog.products.find((product) =>
      product.categories.some((productCategory) => productCategory.id === category.id),
    );
    const primaryImage = matchingProduct?.images.find((image) => image.isPrimary) ?? matchingProduct?.images[0];
    return { category, imageUrl: primaryImage?.publicUrl };
  });

  return (
    <main id="main-content" className="mx-auto min-h-[70vh] w-[calc(100%-2rem)] max-w-[1240px] pb-10 pt-3">
      <nav aria-label={t.breadcrumbs} className="mb-4 flex h-6 items-center justify-start gap-2 text-storefront-support font-bold text-store-muted">
        <Link href={`/s/${catalog.slug}`} className="hover:text-store-primary">{t.home}</Link>
        <ChevronLeft className="size-4" aria-hidden="true" />
        <span aria-current="page" className="text-store-primary">{t.menu}</span>
      </nav>

      <header className="grid min-h-[200px] grid-cols-[minmax(0,1fr)_100px] items-center gap-3 overflow-hidden rounded-3xl bg-store-primary/10 p-4 sm:grid-cols-[minmax(0,1fr)_150px] sm:p-5 lg:min-h-[224px] lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6 lg:rounded-[1.75rem] lg:p-6">
        <div className="min-w-0 -translate-y-2">
          <p className="text-sm font-extrabold text-store-accent">{t.menuHeroEyebrow}</p>
          <h1 className="mt-1 max-w-3xl font-heading text-storefront-page font-black text-store-ink text-balance">
            {t.menuHeroTitle}
          </h1>
          <p className="mt-2 max-w-2xl text-storefront-body text-store-muted">
            {t.menuIntro}
          </p>
        </div>
        <div className="relative aspect-[1.05] w-full overflow-hidden rounded-2xl bg-white/40 lg:aspect-[1.68]">
          <Image
            src="/storefront-assets/burger.webp"
            alt=""
            fill
            priority
            sizes="(max-width: 640px) 100px, (max-width: 1024px) 150px, 300px"
            className="object-cover"
            unoptimized
          />
        </div>
      </header>

      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6">
        <aside className="min-w-0 lg:sticky lg:top-24 lg:h-fit lg:rounded-[1.6rem] lg:border lg:border-store-border lg:bg-white lg:p-4">
          <h2 className="hidden font-heading text-storefront-subsection font-extrabold text-store-ink lg:block">{t.menuCategories}</h2>
          <nav aria-label={t.menuCategories} className="flex min-w-0 gap-2 overflow-x-auto pb-2 lg:mt-3 lg:grid lg:overflow-visible lg:pb-0">
            <button
              type="button"
              aria-current={!initialCategoryId ? 'true' : undefined}
              onClick={() => updateUrl({ category: '' })}
              className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-bold transition lg:flex lg:items-center lg:gap-3 lg:rounded-xl lg:px-3 lg:text-start ${!initialCategoryId ? 'border-store-primary bg-store-primary text-white lg:border-store-primary/15 lg:bg-store-primary/5 lg:text-store-primary' : 'border-store-border bg-white text-store-ink hover:border-store-accent/50 lg:border-transparent'}`}
            >
              <BookOpen className="hidden size-5 shrink-0 lg:block" aria-hidden="true" />
              <span className="lg:hidden">{t.allCategoriesShort}</span>
              <span className="hidden lg:inline">{t.allCategories}</span>
            </button>
            {categoryImages.map(({ category, imageUrl }) => {
              const active = category.id === initialCategoryId;
              return (
                <button
                  type="button"
                  key={category.id}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => updateUrl({ category: category.id })}
                  className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-bold transition lg:flex lg:items-center lg:justify-between lg:gap-3 lg:rounded-xl lg:px-3 lg:text-start ${active ? 'border-store-primary bg-store-primary text-white lg:border-store-primary/15 lg:bg-store-primary/5 lg:text-store-primary' : 'border-store-border bg-white text-store-ink hover:border-store-accent/50 lg:border-transparent'}`}
                >
                  {imageUrl ? (
                    <span className="relative hidden size-8 shrink-0 overflow-hidden rounded-lg lg:block">
                      <Image src={imageUrl} alt="" fill sizes="32px" className="object-cover" unoptimized />
                    </span>
                  ) : null}
                  <span>{category.name}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section aria-label={t.menu} className="min-w-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <form onSubmit={submitSearch} role="search" className="relative flex min-w-0 flex-1">
              <div className="relative min-w-0 flex-1">
                <Input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.currentTarget.value)}
                  placeholder={t.searchProducts}
                  aria-label={t.searchProducts}
                  className="h-11 rounded-xl border-store-border bg-white ps-11 text-storefront-body sm:h-12"
                />
                <button
                  type="submit"
                  aria-label={t.searchProducts}
                  className="absolute start-1 top-1 grid size-11 place-items-center rounded-lg text-store-muted transition hover:text-store-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-accent"
                >
                  <Search className="size-5" aria-hidden="true" />
                </button>
              </div>
            </form>
            <label className="relative flex h-11 min-w-48 shrink-0 items-center gap-2 self-start rounded-full border border-store-border bg-white px-4 text-sm font-bold text-store-ink focus-within:ring-2 focus-within:ring-store-accent focus-within:ring-offset-2 sm:h-12">
              <SlidersHorizontal className="size-4 shrink-0 text-store-ink" aria-hidden="true" />
              <span className="min-w-0 truncate">{sortLabel}</span>
              <select
                value={sort}
                onChange={(event) => updateUrl({ sort: event.currentTarget.value })}
                aria-label={t.sort}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              >
                <option value="default">{t.sort}</option>
                <option value="price-asc">{t.priceAscending}</option>
                <option value="price-desc">{t.priceDescending}</option>
              </select>
            </label>
          </div>

          <header className="mb-4 mt-4 flex items-end justify-between gap-4 sm:mb-4 sm:mt-5">
            <div>
              <h2 className="font-heading text-storefront-section font-extrabold text-store-ink">
                {t.allProducts}
              </h2>
              <p className="mt-1 text-storefront-support text-store-muted">{number} {t.productsToDisplay}</p>
            </div>
          </header>

          {filteredProducts.length ? (
            <StorefrontProductGrid products={filteredProducts} slug={catalog.slug} layout="menu" />
          ) : (
            <div className="grid min-h-64 place-items-center rounded-[1.6rem] border border-dashed border-store-border bg-white px-5 text-center">
              <div>
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-store-cream text-store-accent">
                  <SearchX className="size-7" aria-hidden="true" />
                </span>
                <p className="mt-4 font-heading text-storefront-subsection font-extrabold text-store-ink">
                  {loadedCatalog.products.length ? t.noResults : t.noProducts}
                </p>
              </div>
            </div>
          )}
          {loadedCatalog.nextProductCursor || loadedCatalog.nextCategoryCursor ? (
            <div className="mt-6 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="min-h-11 rounded-full bg-store-primary px-6 text-sm font-extrabold text-white transition hover:bg-store-primary/90 disabled:cursor-wait disabled:opacity-60"
              >
                {loadingMore ? t.loadingMore : t.loadMore}
              </button>
              {loadMoreError ? <p role="alert" className="text-sm text-red-700">{t.loadMoreError}</p> : null}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function appendUnique<T extends { id: string }>(current: T[], next: T[]): T[] {
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...next.filter((item) => !seen.has(item.id))];
}
