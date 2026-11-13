import type { PublicRestaurantProfile, MarketplaceMenuPage, MarketplaceMenuProduct, CursorPage } from '@waffarly/contracts';
import { apiGet, apiGetBrowser } from '@/lib/api-client';
import type { MarketplaceRestaurant } from '../model/restaurants';
import type { MarketplaceProduct } from '@/features/marketplace/catalog/model/catalog';
export function mapRestaurant(profile: PublicRestaurantProfile): MarketplaceRestaurant {
  return { name: profile.name, slug: profile.slug, settings: profile,
    cover: profile.coverImage ?? { src: '', alt: profile.name }, logo: profile.logoImage ?? { src: '', alt: profile.name },
    meta: profile.description, offer: profile.referenceData?.offer ?? '', rating: profile.referenceData?.rating ?? '',
    time: `${profile.deliveryTimeMinMinutes}–${profile.deliveryTimeMaxMinutes} دقيقة` };
}
export function mapRestaurantProduct(product: MarketplaceMenuProduct, restaurant: MarketplaceRestaurant): MarketplaceProduct {
  const image = product.images.find((image) => image.isPrimary) ?? product.images[0];
  return { id: product.id, name: product.name, cartName: product.name, searchName: product.name,
    description: product.description ?? '', price: Number(product.basePrice), displayPrice: product.basePrice,
    category: 'food', image: { src: image?.publicUrl ?? '', alt: product.name }, cartImage: image?.publicUrl ?? '',
    seller: restaurant.name, merchantName: restaurant.name, merchantType: 'restaurant', origin: 'api',
    rating: '', discount: '', oldPrice: '', delivery: 'رسوم التوصيل تُراجع عند إتمام الطلب', available: product.availability === 'available',
    menuSection: product.categories.find((category) => category.id === product.menuSectionId)?.name ?? product.categories[0]?.name ?? 'الوجبات',
    ...(restaurant.slug !== undefined ? { restaurantSlug: restaurant.slug } : {}),
    ...(restaurant.settings !== undefined ? { restaurantSettings: restaurant.settings } : {}),
    apiVariants: product.variants, apiModifierGroups: product.modifierGroups };
}
export async function loadRestaurants(browser = false) {
  const get = browser ? apiGetBrowser : apiGet;
  const items: MarketplaceRestaurant[] = [];
  let cursor: string | null = null;
  do {
    const page: CursorPage<PublicRestaurantProfile> = await get<CursorPage<PublicRestaurantProfile>>(`marketplace/restaurants${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { revalidate: 0 });
    items.push(...page.items.map(mapRestaurant));
    if (page.nextCursor === cursor && cursor) throw new Error('Invalid restaurant pagination.');
    cursor = page.nextCursor;
  } while (cursor);
  return items;
}
export async function loadRestaurant(slug: string) {
  const profile = await apiGet<PublicRestaurantProfile & { catalog: MarketplaceMenuPage }>(`marketplace/restaurants/${encodeURIComponent(slug)}`, { revalidate: 0 });
  const restaurant = mapRestaurant(profile);
  const records = [...profile.catalog.items];
  let cursor = profile.catalog.nextCursor;
  while (cursor) {
    const page: MarketplaceMenuPage = await apiGet(`marketplace/restaurants/${encodeURIComponent(slug)}/products?cursor=${encodeURIComponent(cursor)}`, { revalidate: 0 });
    records.push(...page.items);
    if (page.nextCursor === cursor) throw new Error('Invalid menu pagination.');
    cursor = page.nextCursor;
  }
  return { restaurant, products: records.map((product) => mapRestaurantProduct(product, restaurant)), records };
}
