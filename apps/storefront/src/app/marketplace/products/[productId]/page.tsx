import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { findProduct } from '@/features/marketplace/catalog/model/catalog';
import { productBackHref } from '@/features/marketplace/product-detail/model/product-navigation';
import { ProductDetailPage } from '@/features/marketplace/product-detail/components/product-detail-page';

type Props = {
  params: Promise<{ productId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = findProduct((await params).productId);
  return { title: product ? `${product.cartName} | وفّرلي` : 'المنتج غير موجود | وفّرلي' };
}

export default async function ProductPage({ params, searchParams }: Props) {
  const product = findProduct((await params).productId);
  if (!product) notFound();
  const search = await searchParams;
  const values = new URLSearchParams();
  for (const key of ['q', 'category']) {
    const value = search[key];
    if (typeof value === 'string') values.set(key, value);
  }
  return <ProductDetailPage product={product} backHref={productBackHref(values.toString())} />;
}
