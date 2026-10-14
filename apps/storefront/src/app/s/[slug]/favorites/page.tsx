import { requireStorefrontCatalog } from '../../../../features/catalog/storefront-data';
import { StorefrontFavoritesPage } from '../../../../features/favorites/storefront-favorites-page';

type PageProps = { params: Promise<{ slug: string }> };

export default async function FavoritesPage({ params }: PageProps) {
  const { slug } = await params;
  const catalog = await requireStorefrontCatalog(slug);
  return <StorefrontFavoritesPage catalog={catalog} />;
}
