'use client';

import Image from 'next/image';
import Link from '../../components/storefront/storefront-link';
import { ArrowLeft, ArrowRight, BadgeCheck, Clock3, Sparkles, Utensils } from 'lucide-react';
import type { PublicStorefrontCatalog } from '@waffarly/contracts';
import { Badge, Button, Card, useLocale } from '@waffarly/ui';
import { storefrontCopy } from '../../lib/storefront-copy';
import { interpolate } from '../../lib/storefront-copy';
import { StorefrontCategoryCard } from './storefront-category-card';
import { StorefrontProductGrid } from './storefront-product-grid';

const coverShades = {
  light: { mobileMid: 48, mobileTop: 0, desktopEdge: 65, desktopMid: 12 },
  medium: { mobileMid: 65, mobileTop: 5, desktopEdge: 100, desktopMid: 25 },
  strong: { mobileMid: 83, mobileTop: 30, desktopEdge: 100, desktopMid: 55 },
};

function coverTint(strength: number): string {
  return `color-mix(in srgb, var(--storefront-primary-deep) ${strength}%, transparent)`;
}

export function StorefrontHomePage({ catalog }: { catalog: PublicStorefrontCatalog }) {
  const { locale } = useLocale();
  const t = storefrontCopy(locale);
  const imageSource = catalog.coverImageUrl ?? '/storefront-assets/hero-burger.webp';
  const shade = coverShades[catalog.heroShade ?? 'medium'] ?? coverShades.medium;
  const mobileGradient = `linear-gradient(to top, var(--storefront-primary-deep), ${coverTint(shade.mobileMid)}, ${coverTint(shade.mobileTop)})`;
  const direction = locale === 'ar' ? 'left' : 'right';
  const desktopGradient = `linear-gradient(to ${direction}, ${coverTint(shade.desktopEdge)}, ${coverTint(shade.desktopMid)}, transparent)`;
  const Arrow = locale === 'ar' ? ArrowLeft : ArrowRight;
  const offers = catalog.products
    .filter((product) => product.promotion?.status === 'active' || product.promotionalPrice)
    .slice(0, 4);
  const featuredProducts = catalog.products
    .filter((product) => !offers.some((offer) => offer.id === product.id))
    .slice(0, 4);
  const features = [
    {
      icon: Clock3,
      title: locale === 'ar' ? 'تصفح بسهولة' : 'Browse with ease',
      detail: locale === 'ar' ? 'اكتشف القائمة في خطوات بسيطة' : 'Find your next favorite quickly',
    },
    {
      icon: Sparkles,
      title: locale === 'ar' ? 'اختيارات متنوعة' : 'Plenty to explore',
      detail: locale === 'ar' ? 'أقسام وأطباق مختلفة' : 'Explore dishes across the menu',
    },
    {
      icon: BadgeCheck,
      title: locale === 'ar' ? 'تفاصيل واضحة' : 'Clear details',
      detail: locale === 'ar' ? 'راجع اختياراتك قبل الإرسال' : 'Review options before ordering',
    },
  ];

  const hero = (
    <section className="relative isolate grid min-h-[360px] overflow-hidden rounded-3xl bg-store-primary-deep text-white shadow-[0_24px_70px_rgba(6,61,49,0.18)] sm:rounded-[2rem] lg:min-h-[400px] lg:grid-cols-2">
      <div className="absolute inset-0 -z-10 lg:hidden">
        <Image
          src={imageSource}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
          unoptimized
        />
        <div className="absolute inset-0" style={{ backgroundImage: mobileGradient }} />
      </div>
      <div className="relative z-10 flex flex-col items-start justify-end px-5 pt-12 pb-5 sm:justify-center sm:px-8 sm:py-12 lg:col-start-1 lg:row-start-1 lg:px-14 lg:py-11">
        <Badge className="border border-store-gold/30 bg-store-gold/15 px-3 text-store-gold">
          <Sparkles className="size-3.5" aria-hidden="true" />
          {catalog.heroEyebrow || t.heroEyebrow}
        </Badge>
        <h1 className="mt-1 max-w-xl break-words font-heading text-storefront-hero font-black text-balance sm:mt-3">
          {catalog.heroTitle || t.heroTitle}
          <span className="mt-1 block text-store-gold">
            {catalog.heroEmphasis || t.heroEmphasis}
          </span>
        </h1>
        <p className="mt-2 max-w-lg text-[clamp(1rem,1.05vw,1.0625rem)] leading-[1.65] text-white/80 sm:mt-3">
          {catalog.restaurantDescription ||
            interpolate(t.heroDescription, { name: catalog.merchantName })}
        </p>
        <div className="mt-3 flex w-full max-w-[21rem] flex-col gap-2 min-[370px]:flex-row sm:mt-5 sm:w-auto">
          <Button
            asChild
            size="lg"
            className="h-auto min-h-12 min-w-0 flex-1 rounded-xl bg-store-gold px-4 py-2 font-heading text-sm font-extrabold text-store-primary-deep hover:bg-store-gold-muted sm:h-11 sm:min-h-0 sm:px-5 sm:py-0"
          >
            <Link href={`/s/${catalog.slug}/menu`}>
              {t.startOrder}
              <Arrow className="size-4 shrink-0" aria-hidden="true" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-auto min-h-12 min-w-0 flex-1 rounded-xl border-white bg-white px-4 py-2 font-heading text-sm font-extrabold text-store-primary-deep hover:bg-store-cream hover:text-store-primary-deep sm:h-11 sm:min-h-0 sm:px-5 sm:py-0"
          >
            <Link href={catalog.categories.length ? '#categories' : '#products'}>
              {t.browseCategories}
            </Link>
          </Button>
        </div>
      </div>
      <div className="relative hidden min-h-[400px] lg:col-start-2 lg:row-start-1 lg:block">
        <Image
          src={imageSource}
          alt=""
          fill
          priority
          sizes="(max-width: 1280px) 50vw, 620px"
          className="object-cover"
          unoptimized
        />
        <div className="absolute inset-0" style={{ backgroundImage: desktopGradient }} />
      </div>
    </section>
  );

  const highlights = (
    <section
      aria-label={locale === 'ar' ? 'مميزات التصفح' : 'Browsing highlights'}
      className="relative z-10 mx-auto -mt-2.5 grid w-[calc(100%-1rem)] max-w-[1060px] grid-cols-1 rounded-[1.35rem] border border-store-border bg-white px-2 py-3 shadow-[0_14px_40px_rgba(23,35,48,0.08)] sm:-mt-9 sm:grid-cols-3 sm:px-4 sm:py-4"
    >
      {features.map(({ icon: Icon, title, detail }, index) => (
        <div
          key={title}
          className={`flex min-w-0 items-center justify-center gap-2 px-2 sm:flex-row sm:gap-3 sm:px-4 ${index > 0 ? 'sm:border-s sm:border-store-border' : ''} ${index < 2 ? 'hidden sm:flex' : 'sm:flex'}`}
        >
          <span
            className={`grid size-9 shrink-0 place-items-center rounded-xl sm:size-11 ${index === 1 ? 'bg-store-gold/20 text-store-gold-muted' : 'bg-store-primary/10 text-store-primary'}`}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <span className="grid min-w-0 justify-items-start text-start">
            <strong className="font-heading text-xs font-extrabold leading-4 text-store-ink">
              {title}
            </strong>
            <span className="mt-0.5 text-storefront-caption leading-4 text-store-muted sm:mt-1">
              {detail}
            </span>
          </span>
        </div>
      ))}
    </section>
  );

  const categories = catalog.categories.length > 0 && (
    <section
      id="categories"
      className="mt-5 scroll-mt-20 lg:scroll-mt-28"
      aria-labelledby="categories-heading"
    >
      <div className="flex items-end justify-end gap-4">
        <div className="sr-only">
          <h2 id="categories-heading" className="sr-only">
            {t.categorySectionTitle}
          </h2>
          <p className="mt-1 text-storefront-support text-store-muted">
            {t.categorySectionDescription}
          </p>
        </div>
        <Link
          href={`/s/${catalog.slug}/menu`}
          className="inline-flex items-center gap-2 pb-1 text-sm font-extrabold text-store-accent hover:text-store-primary-deep"
        >
          {t.allItems}
          <Arrow className="size-4" aria-hidden="true" />
        </Link>
      </div>
      <div className="mt-3 grid auto-cols-[140px] grid-flow-col gap-3 overflow-x-auto pb-2 sm:auto-cols-[180px]">
        {catalog.categories.map((category) => {
          const categoryProduct = catalog.products.find((product) =>
            product.categories.some((item) => item.id === category.id),
          );
          const categoryImage =
            categoryProduct?.images.find((image) => image.isPrimary) ?? categoryProduct?.images[0];
          return (
            <StorefrontCategoryCard
              key={category.id}
              href={`/s/${catalog.slug}/menu?category=${encodeURIComponent(category.id)}`}
              imageUrl={categoryImage?.publicUrl}
              productCount={
                catalog.products.filter((product) =>
                  product.categories.some((item) => item.id === category.id),
                ).length
              }
              productsLabel={t.products}
              title={category.name}
            />
          );
        })}
      </div>
    </section>
  );

  const featured = (
    <section className="mt-5 pb-5" aria-labelledby="featured-heading">
      <div className="mb-4 flex items-end justify-end gap-4">
        <div className="sr-only">
          <p className="text-sm font-extrabold text-store-accent">{t.brandTagline}</p>
          <h2 id="featured-heading" className="sr-only">
            {t.featuredItems}
          </h2>
        </div>
        <Link
          href={`/s/${catalog.slug}/menu`}
          className="inline-flex items-center gap-2 pb-1 text-sm font-extrabold text-store-accent hover:text-store-primary-deep"
        >
          {t.allItems}
          <Arrow className="size-4" aria-hidden="true" />
        </Link>
      </div>
      {featuredProducts.length ? (
        <StorefrontProductGrid products={featuredProducts} slug={catalog.slug} />
      ) : (
        <Card className="grid min-h-48 place-items-center rounded-3xl border-dashed border-store-border bg-white text-center">
          <div>
            <Utensils className="mx-auto size-9 text-store-accent" aria-hidden="true" />
            <p className="mt-3 font-bold text-store-ink">{t.noProducts}</p>
          </div>
        </Card>
      )}
    </section>
  );

  return (
    <main id="main-content" className="mx-auto w-[calc(100%-2rem)] max-w-[1240px] pt-2 sm:pt-5">
      {hero}
      {highlights}
      {categories}
      <div id="products" className="flow-root scroll-mt-20 lg:scroll-mt-28">
        {offers.length > 0 && (
          <section
            aria-label={locale === 'ar' ? 'العروض الحالية' : 'Current offers'}
            className="mt-5"
          >
            <div className="mb-3 flex justify-end">
              <Link
                className="text-sm font-bold text-store-primary"
                href={`/s/${catalog.slug}/offers`}
              >
                {locale === 'ar' ? 'شوف العروض' : 'View offers'}{' '}
                <Arrow className="inline size-4" aria-hidden="true" />
              </Link>
            </div>
            <StorefrontProductGrid products={offers} slug={catalog.slug} />
          </section>
        )}
        {(featuredProducts.length > 0 || catalog.products.length === 0) && featured}
      </div>
      <section
        aria-label={locale === 'ar' ? 'معلومات المطعم' : 'Restaurant information'}
        className="mb-6 grid gap-3 rounded-2xl border border-store-border bg-white p-4 text-sm"
      >
        <Link
          href={`/s/${catalog.slug}/branches`}
          className="flex min-h-11 items-center justify-between gap-2 font-bold text-store-primary"
        >
          {locale === 'ar' ? 'الفروع والتوصيل والاستلام' : 'Branches, delivery and pickup'}{' '}
          <Arrow className="size-4" aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
