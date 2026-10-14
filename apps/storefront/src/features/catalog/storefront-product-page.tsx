'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Utensils } from 'lucide-react';
import type { PublicStorefrontCatalog, PublicStorefrontProduct } from '@waffarly/contracts';
import { Badge, Card } from '@waffarly/ui';
import { useLocale } from '@waffarly/ui';
import { formatStorefrontPrice, getProductStartingPrice } from '../../lib/storefront-format';
import { getStorefrontProductImage } from '../../lib/storefront-images';
import { storefrontCopy } from '../../lib/storefront-copy';
import { StorefrontProductCustomizer } from './storefront-product-customizer';

export function StorefrontProductPage({
  catalog,
  product,
}: {
  catalog: PublicStorefrontCatalog;
  product: PublicStorefrontProduct;
}) {
  const { locale } = useLocale();
  const t = storefrontCopy(locale);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const images = [...product.images].sort((left, right) => left.position - right.position);
  const primaryImage = images.find((item) => item.isPrimary) ?? images[0];
  const selectedImage = selectedImageUrl
    ? images.find((item) => item.publicUrl === selectedImageUrl) ?? primaryImage
    : primaryImage;
  const imageUrl = selectedImageUrl
    ? selectedImage?.publicUrl ?? getStorefrontProductImage(product, 'detail')
    : images.length > 1
      ? primaryImage?.publicUrl
      : getStorefrontProductImage(product, 'detail');
  const hasAvailableVariant = product.variants.some((variant) => variant.availability === 'available');
  const unavailable = product.variants.length > 0 && !hasAvailableVariant;
  const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight;

  return (
    <main id="main-content" className="mx-auto min-h-[70vh] w-[calc(100%-2rem)] max-w-[1240px] pb-12 pt-4 sm:pt-6">
      <nav aria-label={t.breadcrumbs} className="mb-5 flex min-h-8 items-center gap-2 overflow-hidden text-sm font-bold text-store-muted sm:mb-7">
        <Link href={`/s/${catalog.slug}`} className="shrink-0 transition hover:text-store-primary focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-accent">
          {t.home}
        </Link>
        <Chevron className="size-4 shrink-0" aria-hidden="true" />
        <Link href={`/s/${catalog.slug}/menu`} className="shrink-0 transition hover:text-store-primary focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-accent">
          {t.menu}
        </Link>
        <Chevron className="size-4 shrink-0" aria-hidden="true" />
        <span aria-current="page" className="truncate text-store-primary-deep">{product.name}</span>
      </nav>

      <div className="grid min-w-0 items-start gap-5 sm:gap-7 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-9">
        <section aria-label={t.productImages} className="min-w-0 lg:sticky lg:top-28">
          <div className="relative aspect-[1.36] overflow-hidden rounded-[1.6rem] border border-store-border bg-store-cream shadow-[0_14px_42px_rgba(23,35,48,0.08)] sm:rounded-[1.9rem] lg:aspect-[1.39]">
            {imageUrl ? (
              <Image
                key={imageUrl}
                src={imageUrl}
                alt={product.name}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 650px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="grid size-full place-items-center text-store-primary/35" aria-label={t.noImage}>
                <Utensils className="size-20" aria-hidden="true" />
              </div>
            )}
          </div>

          {images.length > 1 && (
            <div className="mt-3 flex gap-3 overflow-x-auto pb-1" aria-label={t.productImages}>
              {images.map((image, index) => {
                const active = image.publicUrl === selectedImage?.publicUrl;
                return (
                  <button
                    type="button"
                    key={image.publicUrl}
                    aria-label={`${t.viewImage} ${index + 1}`}
                    aria-pressed={active}
                    onClick={() => setSelectedImageUrl(image.publicUrl)}
                    className={`relative size-[4.5rem] shrink-0 overflow-hidden rounded-xl border-2 bg-store-cream transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-accent focus-visible:ring-offset-2 sm:size-20 ${active ? 'border-store-primary shadow-sm' : 'border-store-border hover:border-store-accent/60'}`}
                  >
                    <Image src={image.publicUrl} alt="" fill sizes="80px" className="object-cover" unoptimized />
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <div className="grid min-w-0 gap-4 sm:gap-5">
          <Card className="grid gap-4 rounded-[1.6rem] border-store-border bg-white p-5 shadow-[0_10px_34px_rgba(23,35,48,0.05)] sm:gap-5 sm:rounded-[1.9rem] sm:p-7 lg:p-8">
            <div className="flex flex-wrap gap-2">
              {product.categories.map((category) => (
                <Badge key={category.id} className="border-0 bg-store-cream text-store-primary-deep">
                  {category.name}
                </Badge>
              ))}
            </div>

            <header>
              <p className="text-sm font-extrabold text-store-accent">{catalog.merchantName}</p>
              <h1 className="mt-1.5 font-heading text-[28px] font-black leading-tight text-store-ink text-balance sm:mt-2 sm:text-4xl">
                {product.name}
              </h1>
              {product.description && (
                <p className="mt-3 text-sm leading-7 text-store-muted sm:mt-4 sm:text-base sm:leading-8">
                  {product.description}
                </p>
              )}
            </header>

            <div className="flex min-h-16 items-center justify-between gap-4 border-y border-store-border py-3.5 sm:py-4">
              <div>
                {unavailable ? (
                  <span className="font-bold text-store-muted">{t.unavailable}</span>
                ) : (
                  <>
                    {product.variants.length > 0 && (
                      <span className="mb-1 block text-xs font-medium text-store-muted sm:text-sm">{t.priceFrom}</span>
                    )}
                    <strong className="font-heading text-2xl font-extrabold text-store-primary-deep sm:text-[28px]">
                      <bdi dir="auto">{formatStorefrontPrice(getProductStartingPrice(product), locale)}</bdi>
                    </strong>
                  </>
                )}
              </div>
              {product.variants.length > 0 && !unavailable && (
                <span className="max-w-40 text-end text-xs leading-5 text-store-muted">{t.chooseVariant}</span>
              )}
            </div>
          </Card>

          {unavailable ? (
            <p className="rounded-2xl border border-store-border bg-white px-5 py-4 text-sm font-bold text-store-muted" role="status">
              {t.unavailable}
            </p>
          ) : (
            <StorefrontProductCustomizer
              key={product.id}
              product={product}
              slug={catalog.slug}
              presentation="inline"
            />
          )}
        </div>
      </div>
    </main>
  );
}
