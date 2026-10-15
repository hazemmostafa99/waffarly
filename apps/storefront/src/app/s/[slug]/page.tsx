import { requireStorefrontCatalog } from '../../../features/catalog/storefront-data';
import { StorefrontHomePage } from '../../../features/catalog/storefront-home-page';

type PageProps = { params: Promise<{ slug: string }> };

export default async function StorefrontHome({ params }: PageProps) {
  const { slug } = await params;
  const catalog = await requireStorefrontCatalog(slug);
  return <StorefrontHomePage catalog={catalog} />;
}
