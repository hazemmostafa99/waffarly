import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, BadgeCheck, Clock3, Sparkles, Utensils } from 'lucide-react';
import type { PublicStorefrontCatalog } from '@waffarly/contracts';
import { Badge, Button, Card } from '@waffarly/ui';
import { storefrontCopy } from '../../lib/storefront-copy';
import { interpolate } from '../../lib/storefront-copy';
import { StorefrontProductGrid } from './storefront-product-grid';

export function StorefrontHomePage({
  catalog,
  locale,
}: {
  catalog: PublicStorefrontCatalog;
  locale: 'ar' | 'en';
}) {
  const t = storefrontCopy(locale);
  const imageSource = '/storefront-assets/hero-burger.webp';
  const Arrow = locale === 'ar' ? ArrowLeft : ArrowRight;
  const featuredProducts = catalog.products.slice(0, 4);
  const features = [
    { icon: Clock3, title: locale === 'ar' ? 'تصفح بسهولة' : 'Browse with ease', detail: locale === 'ar' ? 'اكتشف القائمة في خطوات بسيطة' : 'Find your next favorite quickly' },
    { icon: Sparkles, title: locale === 'ar' ? 'اختيارات متنوعة' : 'Plenty to explore', detail: locale === 'ar' ? 'أقسام وأطباق مختلفة' : 'Explore dishes across the menu' },
    { icon: BadgeCheck, title: locale === 'ar' ? 'تفاصيل واضحة' : 'Clear details', detail: locale === 'ar' ? 'راجع اختياراتك قبل الإرسال' : 'Review options before ordering' },
  ];

  return (
    <main id="main-content" className="mx-auto w-[calc(100%-2rem)] max-w-[1240px] pt-3 sm:pt-7">
      <section className="relative isolate grid min-h-[444px] overflow-hidden rounded-3xl bg-store-primary-deep text-white shadow-[0_24px_70px_rgba(6,61,49,0.18)] sm:rounded-[2rem] lg:min-h-[496px] lg:grid-cols-2">
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
          <div className="absolute inset-0 bg-gradient-to-t from-store-primary-deep via-store-primary-deep/65 to-store-primary-deep/5" />
        </div>
        <div className="relative z-10 flex flex-col items-start justify-end px-6 pt-16 pb-7 sm:justify-center sm:px-10 sm:py-16 lg:col-start-1 lg:row-start-1 lg:px-20 lg:py-14">
          <Badge className="border border-store-gold/30 bg-store-gold/15 px-3 text-store-gold">
            <Sparkles className="size-3.5" aria-hidden="true" />
            {t.heroEyebrow}
          </Badge>
          <h1 className="mt-1 max-w-xl font-heading text-[clamp(2.5rem,5vw,4rem)] font-black leading-[1.1] text-balance sm:mt-5 sm:leading-[1.22]">
            {t.heroTitle}
            <span className="mt-1 block text-store-gold">{t.heroEmphasis}</span>
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-6 text-white/80 sm:mt-4 sm:text-lg sm:leading-8">
            {interpolate(t.heroDescription, { name: catalog.merchantName })}
          </p>
          <div className="mt-4 flex w-full max-w-[22rem] flex-col gap-3 min-[370px]:flex-row sm:mt-7 sm:w-auto">
            <Button
              asChild
              size="lg"
              className="h-auto min-h-[80px] min-w-0 flex-1 rounded-xl bg-store-gold px-5 py-3 font-heading text-base font-extrabold text-store-primary-deep hover:bg-store-gold-muted sm:h-[50px] sm:min-h-0 sm:px-6 sm:py-0"
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
              className="h-auto min-h-[80px] min-w-0 flex-1 rounded-xl border-white bg-white px-5 py-3 font-heading text-base font-extrabold text-store-primary-deep hover:bg-store-cream hover:text-store-primary-deep sm:h-[50px] sm:min-h-0 sm:px-6 sm:py-0"
            >
              <Link href="#categories">{t.browseCategories}</Link>
            </Button>
          </div>
        </div>
        <div className="relative hidden min-h-[496px] lg:col-start-2 lg:row-start-1 lg:block">
          <Image
            src={imageSource}
            alt=""
            fill
            priority
            sizes="(max-width: 1280px) 50vw, 620px"
            className="object-cover"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-l from-store-primary-deep via-store-primary-deep/25 to-transparent" />
        </div>
      </section>

      <section aria-label={locale === 'ar' ? 'مميزات التصفح' : 'Browsing highlights'} className="relative z-10 mx-auto -mt-2.5 grid w-[calc(100%-1rem)] max-w-[1060px] grid-cols-3 rounded-[1.35rem] border border-store-border bg-white px-2 py-4 shadow-[0_14px_40px_rgba(23,35,48,0.08)] sm:-mt-12 sm:px-5 sm:py-6">
        {features.map(({ icon: Icon, title, detail }, index) => (
          <div key={title} className={`flex min-w-0 flex-col items-center justify-center gap-1 px-1 sm:flex-row sm:gap-3 sm:px-4 ${index > 0 ? 'border-s border-store-border' : ''}`}>
            <span className={`grid size-9 shrink-0 place-items-center rounded-xl sm:size-11 ${index === 1 ? 'bg-store-gold/20 text-store-gold-muted' : 'bg-store-primary/10 text-store-primary'}`}>
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <span className="grid min-w-0 justify-items-center text-center sm:justify-items-start sm:text-start">
              <strong className="max-w-24 truncate font-heading text-[11px] font-extrabold leading-4 text-store-ink sm:max-w-none sm:text-sm">{title}</strong>
              <span className="mt-0.5 max-w-28 truncate text-[9px] leading-4 text-store-muted sm:mt-1 sm:text-xs">{detail}</span>
            </span>
          </div>
        ))}
      </section>

      {catalog.categories.length > 0 && (
        <section id="categories" className="mt-6 sm:mt-10" aria-labelledby="categories-heading">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 id="categories-heading" className="font-heading text-2xl font-black text-store-ink sm:text-3xl">
                {t.categorySectionTitle}
              </h2>
              <p className="mt-1 text-sm text-store-muted sm:text-base">{t.categorySectionDescription}</p>
            </div>
            <Link href={`/s/${catalog.slug}/menu`} className="inline-flex items-center gap-2 pb-1 text-sm font-extrabold text-store-accent hover:text-store-primary-deep">
              {t.allItems}<Arrow className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-5 grid grid-flow-col auto-cols-[minmax(132px,1fr)] gap-3 overflow-x-auto pb-3 [scrollbar-width:thin] sm:mt-10 sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-4 lg:grid-cols-6">
            {catalog.categories.map((category, index) => {
              const categoryProduct = catalog.products.find((product) => product.categories.some((item) => item.id === category.id));
              const categoryImage = categoryProduct?.images.find((image) => image.isPrimary) ?? categoryProduct?.images[0];
              return (
                <Link
                  key={category.id}
                  href={`/s/${catalog.slug}/menu?category=${encodeURIComponent(category.id)}`}
                  className="group min-w-0 rounded-2xl border border-store-border bg-white p-2 transition hover:border-store-accent/40 hover:shadow-md sm:p-2.5"
                >
                  <span className={`relative grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-xl ${index % 2 ? 'bg-store-gold/20' : 'bg-store-primary/10'}`}>
                    {categoryImage ? (
                      <Image src={categoryImage.publicUrl} alt="" fill sizes="56px" className="object-cover" unoptimized />
                    ) : (
                      <Utensils className="size-6 text-store-accent" aria-hidden="true" />
                    )}
                  </span>
                  <span className="mt-2 block min-w-0 text-center">
                    <strong className="block truncate font-heading text-sm font-extrabold text-store-ink">{category.name}</strong>
                    <span className="mt-1 block text-xs text-store-muted">{catalog.products.filter((product) => product.categories.some((item) => item.id === category.id)).length} {t.products}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-12 pb-5 sm:mt-16" aria-labelledby="featured-heading">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-extrabold text-store-accent">{t.brandTagline}</p>
            <h2 id="featured-heading" className="mt-1 font-heading text-2xl font-black text-store-ink sm:text-3xl">
              {t.featuredItems}
            </h2>
          </div>
          <Link href={`/s/${catalog.slug}/menu`} className="inline-flex items-center gap-2 pb-1 text-sm font-extrabold text-store-accent hover:text-store-primary-deep">
            {t.allItems}<Arrow className="size-4" aria-hidden="true" />
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
    </main>
  );
}
