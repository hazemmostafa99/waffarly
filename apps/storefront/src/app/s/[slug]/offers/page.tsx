import { StorefrontOffersPage } from '../../../../features/storefront-pages';
import { requireStorefrontCatalog } from '../../../../features/catalog/storefront-data';

export default async function OffersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const catalog = await requireStorefrontCatalog(slug);
  return <StorefrontOffersPage catalog={catalog} />;
}
