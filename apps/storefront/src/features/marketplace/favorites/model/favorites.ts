import { findProduct, type MarketplaceProduct } from '@/features/marketplace/catalog/model/catalog';

export function favoriteProducts(productIds: string[]): MarketplaceProduct[] {
  return productIds.flatMap((productId) => {
    const product = findProduct(productId);
    return product ? [product] : [];
  });
}
