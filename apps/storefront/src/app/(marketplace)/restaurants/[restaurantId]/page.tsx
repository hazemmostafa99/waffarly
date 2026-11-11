import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { MarketplaceFooter } from '@/features/marketplace/navigation/components/marketplace-footer';
import { MarketplaceSiteHeader } from '@/features/marketplace/navigation/components/marketplace-site-header';
import { RestaurantDetailPage } from '@/features/marketplace/restaurants/components/restaurant-detail-page';
import { MarketplaceHeaderSkeleton } from '@/features/marketplace/navigation/components/marketplace-header-skeleton';
import { loadRestaurant, loadRestaurants } from '@/features/marketplace/restaurants/data/restaurant-api';
import { ApiError } from '@/lib/api-client';
import { cache } from 'react';
const requireRestaurant = cache(async (identifier: string) => {
  const decoded = decodeURIComponent(identifier);
  const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(decoded) ? decoded : (await loadRestaurants()).find((item) => item.name === decoded)?.slug;
  if (!slug) notFound();
  try { return await loadRestaurant(slug); } catch (error) { if (error instanceof ApiError && error.statusCode === 404) notFound(); throw error; }
});

type Props = { params: Promise<{ restaurantId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { restaurant, products } = await requireRestaurant((await params).restaurantId);
  return {
    title: restaurant ? `${restaurant.name} | وفّرلي` : 'المطعم غير موجود | وفّرلي',
  };
}

export default async function MarketplaceRestaurantPage({ params }: Props) {
  const { restaurant, products } = await requireRestaurant((await params).restaurantId);
  if (!restaurant) notFound();

  return (
    <>
      <Suspense fallback={<MarketplaceHeaderSkeleton />}>
        <MarketplaceSiteHeader />
      </Suspense>
      <RestaurantDetailPage restaurant={restaurant} products={products} />
      <MarketplaceFooter />
    </>
  );
}
