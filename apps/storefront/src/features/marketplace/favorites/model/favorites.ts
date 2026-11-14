import { findProduct, type MarketplaceProduct } from '@/features/marketplace/catalog/model/catalog';

// Keep display data only. Live prices, options and checkout always come from the product page.
export function favoriteSnapshot(product: MarketplaceProduct): MarketplaceProduct {
  return {
    id: product.id, name: product.name, cartName: product.cartName,
    searchName: product.searchName, category: product.category,
    price: product.price, displayPrice: product.displayPrice,
    image: { src: product.image.src, alt: product.image.alt },
    cartImage: product.cartImage, seller: product.seller,
    rating: product.rating, discount: product.discount,
    oldPrice: product.oldPrice, delivery: product.delivery,
    ...(product.merchantType !== undefined ? { merchantType: product.merchantType } : {}),
    ...(product.merchantName !== undefined ? { merchantName: product.merchantName } : {}),
    ...(product.restaurantSlug !== undefined ? { restaurantSlug: product.restaurantSlug } : {}),
    ...(product.origin !== undefined ? { origin: product.origin } : {}),
    ...(product.available !== undefined ? { available: product.available } : {}),
  };
}

export function readFavoriteSnapshots(value: unknown): Record<string, MarketplaceProduct> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const entries = Object.entries(value).filter(([id, item]) => {
    if (!item || typeof item !== 'object' || id !== item.id) return false;
    return ['id', 'name', 'cartName', 'searchName', 'category', 'displayPrice', 'cartImage',
      'seller', 'rating', 'discount', 'oldPrice', 'delivery'].every((key) => typeof item[key] === 'string') &&
      typeof item.price === 'number' && Number.isFinite(item.price) && item.price >= 0 &&
      item.image && typeof item.image.src === 'string' && typeof item.image.alt === 'string' &&
      (item.restaurantSlug === undefined || typeof item.restaurantSlug === 'string') &&
      (item.merchantName === undefined || typeof item.merchantName === 'string') &&
      (item.available === undefined || typeof item.available === 'boolean') &&
      (item.merchantType === undefined || item.merchantType === 'restaurant' || item.merchantType === 'store') &&
      (item.origin === undefined || item.origin === 'api' || item.origin === 'local-mock');
  });
  return Object.fromEntries(entries.map(([id, item]) => [id, favoriteSnapshot(item)]));
}

export function favoriteProducts(productIds: string[], snapshots: Record<string, MarketplaceProduct> = {}): MarketplaceProduct[] {
  return productIds.flatMap((productId) => {
    const product = findProduct(productId) ?? snapshots[productId];
    return product ? [product] : [];
  });
}
