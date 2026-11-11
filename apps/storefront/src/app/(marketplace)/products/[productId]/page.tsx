import { cache } from 'react';
import { ApiError } from '@/lib/api-client';
import { loadRestaurant, loadRestaurants } from '@/features/marketplace/restaurants/data/restaurant-api';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { findProduct } from '@/features/marketplace/catalog/model/catalog';
import { productBackHref } from '@/features/marketplace/product-detail/model/product-navigation';
import { ProductDetailPage } from '@/features/marketplace/product-detail/components/product-detail-page';

type Props = {
  params: Promise<{ productId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const requireProduct = cache(async (id: string, slug?: string) => {
  const local = findProduct(id);
  if (!slug && local?.merchantType !== 'restaurant') return local;
  const restaurantSlug = slug ?? (await loadRestaurants()).find((item) => item.name === local?.merchantName)?.slug;
  if (!restaurantSlug) notFound();
  try {
    const { products, records } = await loadRestaurant(restaurantSlug);
    return products.find((item) => item.id === id) ?? products[records.findIndex((item) => item.referenceKey === id)];
  } catch (error) { if (error instanceof ApiError && error.statusCode === 404) notFound(); throw error; }
});

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const slug = (await searchParams).restaurant;
  const product = await requireProduct((await params).productId, typeof slug === 'string' ? slug : undefined);
  return { title: product ? `${product.cartName} | وفّرلي` : 'المنتج غير موجود | وفّرلي' };
}

export default async function ProductPage({ params, searchParams }: Props) {
  const slug = (await searchParams).restaurant;
  const product = await requireProduct((await params).productId, typeof slug === 'string' ? slug : undefined);
  if (!product) notFound();
  const search = await searchParams;
  const values = new URLSearchParams();
  for (const key of ['q', 'category', 'returnTo', 'sort', 'page']) {
    const value = search[key];
    if (typeof value === 'string') values.set(key, value);
  }
  return <ProductDetailPage product={product} backHref={productBackHref(values.toString())} relatedProducts={product.restaurantSlug ? (await loadRestaurant(product.restaurantSlug)).products : undefined} />;
}
