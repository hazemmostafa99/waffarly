import Image from 'next/image';
import Link from 'next/link';
import { Utensils } from 'lucide-react';

type StorefrontCategoryCardProps = {
  href: string;
  imageUrl: string | undefined;
  productCount: number;
  productsLabel: string;
  title: string;
};

export function StorefrontCategoryCard({
  href,
  imageUrl,
  productCount,
  productsLabel,
  title,
}: StorefrontCategoryCardProps) {
  return (
    <Link
      href={href}
      className="group flex h-storefront-category-card w-storefront-category-card shrink-0 flex-col items-center justify-start rounded-2xl border border-store-border bg-white px-3 pt-4 pb-2 text-center shadow-sm transition hover:border-store-accent/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-primary focus-visible:ring-offset-2"
    >
      <span className="relative grid size-storefront-category-image shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white bg-store-cream shadow-md">
        {imageUrl ? (
          <Image src={imageUrl} alt="" fill sizes="70px" className="object-cover" unoptimized />
        ) : (
          <Utensils className="size-6 text-store-accent" aria-hidden="true" />
        )}
      </span>
      <strong className="mt-2 block max-w-full truncate font-heading text-storefront-category-title font-extrabold text-store-ink">
        {title}
      </strong>
      <span className="mt-0.5 block text-storefront-category-meta text-store-muted">
        {productCount} {productsLabel}
      </span>
    </Link>
  );
}
