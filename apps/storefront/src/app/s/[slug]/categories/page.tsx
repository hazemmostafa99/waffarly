import { requireStorefrontCatalog } from '../../../../features/catalog/storefront-data';
import { StorefrontCategoriesPage } from '../../../../features/catalog/storefront-categories-page';

export default async function CategoriesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const catalog = await requireStorefrontCatalog(slug);
  return <StorefrontCategoriesPage catalog={catalog} />;
}
