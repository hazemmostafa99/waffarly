import { StorefrontBranchesPage } from '../../../../features/storefront-pages';
import { requireStorefrontCatalog } from '../../../../features/catalog/storefront-data';

export default async function BranchesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const catalog = await requireStorefrontCatalog(slug);
  return <StorefrontBranchesPage catalog={catalog} />;
}
