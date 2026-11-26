import { StorefrontNotFound } from '@/components/storefront/storefront-not-found';

export function MarketplaceEntityNotFound({
  title,
  description,
  href,
  linkLabel,
}: {
  title: string;
  description: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <StorefrontNotFound
      mainId="marketplace-main"
      title={title}
      description={description}
      homeHref={href}
      homeLabel={linkLabel}
    />
  );
}
