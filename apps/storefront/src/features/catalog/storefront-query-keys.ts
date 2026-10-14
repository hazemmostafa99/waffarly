import type { CatalogProductQuoteSelection } from '@waffarly/contracts';

export const storefrontQueryKeys = {
  catalog: (slug: string) => ['storefront', slug, 'catalog'] as const,
  quote: (
    slug: string,
    productId: string,
    variantId: string | null,
    selections: CatalogProductQuoteSelection[],
  ) => ['storefront', slug, 'quote', productId, variantId, selections] as const,
  order: (slug: string) => ['storefront', slug, 'orders'] as const,
};
