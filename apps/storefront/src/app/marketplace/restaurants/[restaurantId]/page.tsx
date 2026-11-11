import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { MarketplaceFooter } from '@/features/marketplace/navigation/components/marketplace-footer';
import { MarketplaceSiteHeader } from '@/features/marketplace/navigation/components/marketplace-site-header';
import { RestaurantDetailPage } from '@/features/marketplace/restaurants/components/restaurant-detail-page';
import { MarketplaceHeaderSkeleton } from '@/features/marketplace/navigation/components/marketplace-header-skeleton';
import { findRestaurant } from '@/features/marketplace/restaurants/model/restaurants';

type Props = { params: Promise<{ restaurantId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const restaurant = findRestaurant((await params).restaurantId);
  return {
    title: restaurant ? `${restaurant.name} | وفّرلي` : 'المطعم غير موجود | وفّرلي',
  };
}

export default async function MarketplaceRestaurantPage({ params }: Props) {
  const restaurant = findRestaurant((await params).restaurantId);
  if (!restaurant) notFound();

  return (
    <>
      <Suspense fallback={<MarketplaceHeaderSkeleton />}>
        <MarketplaceSiteHeader />
      </Suspense>
      <RestaurantDetailPage restaurant={restaurant} />
      <MarketplaceFooter />
    </>
  );
}
