import data from '@/features/marketplace/data/reference.json';
import { type MarketplaceProduct } from '@/features/marketplace/catalog/model/catalog';

export function productRecommendations(product: MarketplaceProduct, limit = 4) {
  const others = data.products.filter((item) => item.id !== product.id);
  return [
    ...others.filter((item) => item.category === product.category),
    ...others.filter((item) => item.category !== product.category),
  ].slice(0, Math.max(0, Math.floor(limit)));
}
