'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from '../../components/storefront/storefront-link';
import { Heart, Plus, Utensils } from 'lucide-react';
import type { PublicStorefrontProduct } from '@waffarly/contracts';
import { Button, Card } from '@waffarly/ui';
import { useLocale } from '@waffarly/ui';
import { formatStorefrontPrice, getProductStartingPrice } from '../../lib/storefront-format';
import { getStorefrontProductImage } from '../../lib/storefront-images';
import { storefrontCopy } from '../../lib/storefront-copy';
import { useStorefrontStore } from '../../providers/storefront-providers';
import { StorefrontProductCustomizer } from './storefront-product-customizer';

export function StorefrontProductCard({
  product,
  slug,
}: {
  product: PublicStorefrontProduct;
  slug: string;
}) {
  const { locale } = useLocale();
  const t = storefrontCopy(locale);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const isFavorite = useStorefrontStore((state) => state.favorites.includes(product.id));
  const toggleFavorite = useStorefrontStore((state) => state.toggleFavorite);
  const imageSource = getStorefrontProductImage(product, 'card');
  const availableVariants = product.variants.filter(
    (variant) => variant.availability === 'available',
  );
  const displayPrice = getProductStartingPrice(product);
  const hasUnavailableVariants = product.variants.length > 0 && availableVariants.length === 0;

  return (
    <>
      <Card className="group overflow-hidden rounded-card border-store-border bg-store-surface p-0 shadow-card transition duration-300 hover:-translate-y-1 hover:border-store-primary/30">
        <div className="relative aspect-[4/3] overflow-hidden bg-store-cream">
          {imageSource ? (
            <Link href={`/s/${slug}/products/${product.id}`} className="absolute inset-0">
              <Image
                src={imageSource}
                alt={product.name}
                fill
                sizes="(max-width: 640px) 46vw, (max-width: 1024px) 44vw, 300px"
                className="object-cover transition duration-500 group-hover:scale-[1.04]"
                unoptimized
              />
            </Link>
          ) : (
            <Link
              href={`/s/${slug}/products/${product.id}`}
              aria-label={`${product.name}: ${t.noImage}`}
              className="absolute inset-0 grid place-items-center text-store-primary/35"
            >
              <Utensils className="size-12" aria-hidden="true" />
            </Link>
          )}
          <button
            type="button"
            aria-label={isFavorite ? t.unfavorite : t.favorite}
            aria-pressed={isFavorite}
            onClick={() => toggleFavorite(product.id)}
            className={`absolute start-2 top-2 grid size-11 place-items-center rounded-full border border-white/80 bg-white/95 shadow-sm transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-accent focus-visible:ring-offset-2 ${isFavorite ? 'text-store-gold-muted' : 'text-store-ink'}`}
          >
            <Heart className={`size-4 ${isFavorite ? 'fill-current' : ''}`} aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-2.5 p-3 sm:p-4">
          <div className="min-h-[68px]">
            <h3 className="line-clamp-2 font-heading text-storefront-product font-extrabold text-store-ink">
              <Link href={`/s/${slug}/products/${product.id}`} className="hover:text-store-accent">
                {product.name}
              </Link>
            </h3>
            {product.description && (
              <p className="mt-1 line-clamp-2 text-storefront-support text-store-muted">
                {product.description}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-store-border pt-2.5">
            <div className="min-w-0">
              {availableVariants.length > 0 && (
                <span className="block text-storefront-caption font-medium text-store-muted">
                  {t.priceFrom}
                </span>
              )}
              <strong className="font-heading text-storefront-price font-extrabold text-store-primary-deep">
                <bdi dir="auto">
                  {hasUnavailableVariants ? '—' : formatStorefrontPrice(displayPrice, locale)}
                </bdi>
              </strong>
            </div>
            <Button
              type="button"
              variant="accent"
              size="icon"
              aria-label={
                hasUnavailableVariants ? t.unavailable : `${t.addToCart}: ${product.name}`
              }
              disabled={hasUnavailableVariants}
              onClick={() => setIsCustomizing(true)}
              className="size-11 shrink-0 rounded-full"
            >
              {hasUnavailableVariants ? (
                <span className="text-xs">—</span>
              ) : (
                <Plus className="size-5" aria-hidden="true" />
              )}
            </Button>
          </div>
          {hasUnavailableVariants && (
            <p className="text-xs font-bold text-store-muted">{t.unavailable}</p>
          )}
        </div>
      </Card>
      {isCustomizing && (
        <StorefrontProductCustomizer
          product={product}
          slug={slug}
          onClose={() => setIsCustomizing(false)}
        />
      )}
    </>
  );
}
