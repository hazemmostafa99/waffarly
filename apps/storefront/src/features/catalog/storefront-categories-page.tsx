'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Search, Sparkles, Utensils } from 'lucide-react';
import type { CursorPage, PublicStorefrontCatalog } from '@waffarly/contracts';
import { useLocale } from '@waffarly/ui';
import Link from '../../components/storefront/storefront-link';
import { apiGetBrowser } from '../../lib/api-client';
import { storefrontCopy } from '../../lib/storefront-copy';

type Category = PublicStorefrontCatalog['categories'][number];

export function StorefrontCategoriesPage({ catalog }: { catalog: PublicStorefrontCatalog }) {
  const { locale } = useLocale();
  const t = storefrontCopy(locale);
  const arabic = locale === 'ar';
  const Arrow = arabic ? ArrowLeft : ArrowRight;
  const [categories, setCategories] = useState(catalog.categories);
  const [nextCursor, setNextCursor] = useState(catalog.nextCategoryCursor);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const query = search.trim().toLocaleLowerCase(arabic ? 'ar-EG' : 'en-EG');
  const visibleCategories = categories.filter((category) =>
    category.name.toLocaleLowerCase(arabic ? 'ar-EG' : 'en-EG').includes(query),
  );

  async function loadMore() {
    if (!nextCursor || loading) return;
    setLoading(true);
    setLoadError(false);
    try {
      const page = await apiGetBrowser<CursorPage<Category>>(
        `catalog/stores/${encodeURIComponent(catalog.slug)}/categories?cursor=${encodeURIComponent(nextCursor)}`,
      );
      setCategories((current) => [
        ...current,
        ...page.items.filter((item) => !current.some((existing) => existing.id === item.id)),
      ]);
      setNextCursor(page.nextCursor);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main id="main-content" className="mx-auto min-h-[70vh] w-[calc(100%-2rem)] max-w-[1240px] pb-12 pt-5 sm:pt-8">
      <nav aria-label={t.breadcrumbs} className="mb-5 flex items-center gap-2 text-sm font-bold text-store-muted">
        <Link href={`/s/${catalog.slug}`} className="hover:text-store-primary">{t.home}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="text-store-primary-deep">{t.browseCategories}</span>
      </nav>

      <section className="relative isolate overflow-hidden rounded-[2rem] bg-store-primary-deep px-6 py-10 text-white sm:px-10 sm:py-12 lg:px-14">
        <div className="pointer-events-none absolute -end-16 -top-24 -z-10 size-72 rounded-full border-[44px] border-white/5 sm:size-96" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-20 end-1/4 -z-10 size-44 rounded-full bg-store-gold/10 blur-2xl" aria-hidden="true" />
        <span className="inline-flex items-center gap-2 rounded-full border border-store-gold/30 bg-store-gold/10 px-4 py-2 text-xs font-bold text-store-gold">
          <Sparkles className="size-4" aria-hidden="true" />
          {arabic ? 'اختيارات على ذوقك' : 'Find your favorites'}
        </span>
        <h1 className="mt-5 max-w-2xl font-heading text-4xl font-black leading-tight sm:text-5xl">
          {arabic ? 'كل الأقسام في مكان واحد' : 'Explore every category'}
        </h1>
        <p className="mt-4 max-w-xl text-base leading-8 text-white/75">
          {arabic
            ? `تصفح أقسام ${catalog.merchantName} واختار اللي نفسك فيه بكل سهولة.`
            : `Browse ${catalog.merchantName}'s categories and find your next favorite.`}
        </p>
        <Link href={`/s/${catalog.slug}/menu`} className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl bg-store-gold px-5 text-sm font-extrabold text-store-primary-deep transition hover:bg-store-gold-muted">
          <BookOpen className="size-4" aria-hidden="true" />
          {t.allItems}
          <Arrow className="size-4" aria-hidden="true" />
        </Link>
      </section>

      <section aria-labelledby="categories-title" className="mt-9 sm:mt-12">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-extrabold text-store-accent">{arabic ? 'استكشف القائمة' : 'Explore the menu'}</p>
            <h2 id="categories-title" className="mt-2 font-heading text-2xl font-black text-store-ink sm:text-3xl">
              {t.browseCategories}
            </h2>
            <p className="mt-2 text-sm text-store-muted">
              {arabic ? 'اختار القسم واطلع على منتجاته' : 'Choose a category to see its items'}
            </p>
          </div>
          {categories.length > 5 && (
            <label className="relative block w-full sm:w-72">
              <Search className="absolute start-4 top-1/2 size-4 -translate-y-1/2 text-store-muted" aria-hidden="true" />
              <span className="sr-only">{arabic ? 'ابحث عن قسم' : 'Search categories'}</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder={arabic ? 'ابحث عن قسم...' : 'Search categories...'}
                className="h-12 w-full rounded-xl border border-store-border bg-white ps-11 pe-4 text-sm text-store-ink outline-none focus:border-store-primary focus:ring-2 focus:ring-store-primary/20"
              />
            </label>
          )}
        </div>

        {visibleCategories.length ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleCategories.map((category, index) => {
              const matchingProducts = catalog.products.filter((product) =>
                product.categories.some((item) => item.id === category.id),
              );
              const image = matchingProducts[0]?.images.find((item) => item.isPrimary)
                ?? matchingProducts[0]?.images[0];
              const productMeta = matchingProducts.length
                ? `${matchingProducts.length} ${t.products}${catalog.nextProductCursor ? (arabic ? ' ظاهرة' : ' shown') : ''}`
                : arabic ? 'اكتشف المنتجات' : 'Explore items';
              return (
                <Link
                  key={category.id}
                  href={`/s/${catalog.slug}/menu?category=${encodeURIComponent(category.id)}`}
                  className="group overflow-hidden rounded-[1.5rem] border border-store-border bg-white shadow-[0_12px_35px_rgba(16,45,35,0.05)] transition hover:-translate-y-1 hover:border-store-accent/50 hover:shadow-[0_20px_40px_rgba(16,45,35,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-primary"
                >
                  <div className="relative grid aspect-[4/3] place-items-center overflow-hidden bg-store-cream">
                    {image ? (
                      <Image src={image.publicUrl} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" className="object-cover transition duration-300 group-hover:scale-105" unoptimized />
                    ) : (
                      <Utensils className="size-12 text-store-accent/60" aria-hidden="true" />
                    )}
                    <span className="absolute start-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold text-store-primary-deep backdrop-blur-sm">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 p-5">
                    <div className="min-w-0">
                      <h3 className="truncate font-heading text-lg font-extrabold text-store-ink">{category.name}</h3>
                      <p className="mt-1 text-xs text-store-muted">{productMeta}</p>
                    </div>
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-store-primary/10 text-store-primary transition group-hover:bg-store-primary group-hover:text-white">
                      <Arrow className="size-4" aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border border-dashed border-store-border bg-white px-6 py-12 text-center">
            <Utensils className="mx-auto size-10 text-store-accent" aria-hidden="true" />
            <p className="mt-4 font-bold text-store-ink">
              {query
                ? arabic ? 'مفيش قسم بالاسم ده' : 'No matching category'
                : arabic ? 'الأقسام لسه مش متاحة' : 'No categories available yet'}
            </p>
            <Link href={`/s/${catalog.slug}/menu`} className="mt-4 inline-flex font-bold text-store-primary hover:underline">
              {t.allItems}
            </Link>
          </div>
        )}

        {nextCursor && (
          <div className="mt-8 text-center">
            <button type="button" onClick={loadMore} disabled={loading} className="min-h-11 rounded-xl border border-store-border bg-white px-6 text-sm font-bold text-store-primary-deep transition hover:border-store-primary disabled:opacity-60">
              {loading ? t.loadingMore : t.loadMore}
            </button>
            {loadError && <p className="mt-3 text-sm text-red-700" role="alert">{t.loadMoreError}</p>}
          </div>
        )}
      </section>
    </main>
  );
}
