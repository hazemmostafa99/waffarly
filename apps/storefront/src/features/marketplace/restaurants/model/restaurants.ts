import data from '@/features/marketplace/data/reference.json';
import { merchantScenarioProducts } from '@/features/marketplace/catalog/model/catalog';

import type { PublicRestaurantProfile } from '@waffarly/contracts';
export type MarketplaceRestaurant = (typeof data.restaurants)[number] & {
  slug?: string;
  settings?: PublicRestaurantProfile;
};

function decodeRestaurantId(restaurantId: string) {
  try {
    return decodeURIComponent(restaurantId);
  } catch {
    return restaurantId;
  }
}

export function findRestaurant(restaurantId: string) {
  const name = decodeRestaurantId(restaurantId);
  return data.restaurants.find((restaurant) => restaurant.name === name);
}

export function restaurantHref(restaurant: Pick<MarketplaceRestaurant, 'name' | 'slug'>) {
  return `/restaurants/${encodeURIComponent(restaurant.slug ?? restaurant.name)}`;
}

export function productsForRestaurant(restaurant: Pick<MarketplaceRestaurant, 'name'>) {
  return merchantScenarioProducts.filter(
    (product) => product.merchantType === 'restaurant' && product.merchantName === restaurant.name,
  );
}
