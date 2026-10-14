import { requireStorefrontCatalog } from '../../../../features/catalog/storefront-data';
import { StorefrontCheckoutPage } from '../../../../features/checkout/storefront-checkout-page';

type PageProps = { params: Promise<{ slug: string }> };

export default async function CheckoutPage({ params }: PageProps) {
  const { slug } = await params;
  const catalog = await requireStorefrontCatalog(slug);
  return <StorefrontCheckoutPage catalog={catalog} />;
}
