'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from '../../components/storefront/storefront-link';
import { ChevronLeft, ChevronRight, Utensils } from 'lucide-react';
import type { PublicStorefrontCatalog, PublicStorefrontProduct } from '@waffarly/contracts';
import { Card } from '@waffarly/ui';
import { useLocale } from '@waffarly/ui';
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
    ? (images.find((item) => item.publicUrl === selectedImageUrl) ?? primaryImage)
    : primaryImage;
  const imageUrl = selectedImageUrl
    ? (selectedImage?.publicUrl ?? getStorefrontProductImage(product, 'detail'))
    : images.length > 1
      ? primaryImage?.publicUrl
      : getStorefrontProductImage(product, 'detail');
  const hasAvailableVariant = product.variants.some(
    (variant) => variant.availability === 'available',
  );
  const unavailable = product.variants.length > 0 && !hasAvailableVariant;
  const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight;

  return (
    <main
      id="main-content"
      className="mx-auto min-h-[70vh] w-[calc(100%-2rem)] max-w-[1080px] pb-10 pt-3 sm:pt-5"
    >
      <nav
        aria-label={t.breadcrumbs}
        className="mb-3 flex min-h-6 items-center gap-2 overflow-hidden text-storefront-support font-bold text-store-muted sm:mb-3"
      >
        <Link
          href={`/s/${catalog.slug}`}
          className="shrink-0 transition hover:text-store-primary focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-accent"
        >
          {t.home}
        </Link>
        <Chevron className="size-4 shrink-0" aria-hidden="true" />
        <Link
          href={`/s/${catalog.slug}/menu`}
          className="shrink-0 transition hover:text-store-primary focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-accent"
        >
          {t.menu}
        </Link>
        <Chevron className="size-4 shrink-0" aria-hidden="true" />
        <span aria-current="page" className="truncate text-store-primary-deep">
          {product.name}
        </span>
      </nav>

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-5">
        <section aria-label={t.productImages} className="min-w-0 lg:sticky lg:top-24">
          <div className="relative aspect-[1.6] max-h-[280px] overflow-hidden rounded-2xl border border-store-border bg-store-cream lg:aspect-[1.25] lg:max-h-[360px]">
            {imageUrl ? (
              <Image
                key={imageUrl}
                src={imageUrl}
                alt={product.name}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 460px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div
                className="grid size-full place-items-center text-store-primary/35"
                aria-label={t.noImage}
              >
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
                    className={`relative size-12 shrink-0 overflow-hidden rounded-xl border-2 bg-store-cream transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-accent focus-visible:ring-offset-2 sm:size-14 ${active ? 'border-store-primary shadow-sm' : 'border-store-border hover:border-store-accent/60'}`}
                  >
                    <Image
                      src={image.publicUrl}
                      alt=""
                      fill
                      sizes="56px"
                      className="object-cover"
                      unoptimized
                    />
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <Card className="grid min-w-0 gap-4 rounded-2xl border-store-border bg-white p-3 shadow-sm sm:p-4">
          <header>
            <h1 className="font-heading text-base font-extrabold leading-6 text-store-ink">
              {product.name}
            </h1>
            {product.description && (
              <p className="mt-1 text-xs leading-5 text-store-muted">{product.description}</p>
            )}
          </header>

          {unavailable ? (
            <p
              className="rounded-2xl border border-store-border bg-white px-5 py-4 text-sm font-bold text-store-muted"
              role="status"
            >
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
        </Card>
      </div>
    </main>
  );
}
