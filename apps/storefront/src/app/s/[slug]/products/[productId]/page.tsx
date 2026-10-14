import { notFound } from 'next/navigation';
import { requireStorefrontCatalog } from '../../../../../features/catalog/storefront-data';
import { StorefrontProductPage } from '../../../../../features/catalog/storefront-product-page';

type PageProps = { params: Promise<{ slug: string; productId: string }> };

export default async function ProductPage({ params }: PageProps) {
  const { slug, productId } = await params;
  const catalog = await requireStorefrontCatalog(slug);
  const product = catalog.products.find((item) => item.id === productId);
  if (!product) notFound();
  return <StorefrontProductPage catalog={catalog} product={product} />;
}
