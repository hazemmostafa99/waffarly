import { requireStorefrontCatalog } from '../../../../features/catalog/storefront-data';
import { StorefrontCartPage } from '../../../../features/cart/storefront-cart-page';

type PageProps = { params: Promise<{ slug: string }> };

export default async function CartPage({ params }: PageProps) {
  const { slug } = await params;
  const catalog = await requireStorefrontCatalog(slug);
  return <StorefrontCartPage catalog={catalog} />;
}
